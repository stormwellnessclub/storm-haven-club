// Phase 2C.5B3 — authorized changes to a sold PT payment plan.
//
// Two operations, both keeping Storm and Stripe in step:
//   set_payment_method → the card used for FUTURE unpaid installments only
//   reschedule         → move a future unpaid installment (one, or one + later)
//
// Historical paid installments are never touched or relabelled.
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireStaff } from "../_shared/requireStaff.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Midday America/Detroit for a YYYY-MM-DD business date, as a unix timestamp. */
function detroitNoonEpoch(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map((v) => parseInt(v, 10));
  return Math.floor(Date.UTC(y, m - 1, d, 16, 0, 0) / 1000);
}

function addInterval(iso: string, unit: string, count: number): string {
  const [y, m, d] = iso.split("-").map((v) => parseInt(v, 10));
  const base = new Date(Date.UTC(y, m - 1, d));
  if (unit === "week") base.setUTCDate(base.getUTCDate() + 7 * count);
  else if (unit === "year") base.setUTCFullYear(base.getUTCFullYear() + count);
  else base.setUTCMonth(base.getUTCMonth() + count);
  return base.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireStaff(req, ["super_admin", "admin", "manager"]);
  if (!auth.ok) return auth.response;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const body = await req.json();
    const op: string = body?.op;
    const passId: string = body?.passId;
    const testMode: boolean = body?.testMode === true;
    if (!op || !passId) throw new Error("op and passId are required");

    const stripeKey = testMode
      ? Deno.env.get("STRIPE_TEST_SECRET_KEY")
      : Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe key not configured");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const { data: pass, error: passErr } = await supabase
      .from("pt_passes").select("*").eq("id", passId).maybeSingle();
    if (passErr) throw passErr;
    if (!pass) throw new Error("Package not found");

    const scheduleId: string | null =
      (pass.stripe_subscription_id ?? "").startsWith("sub_sched_")
        ? pass.stripe_subscription_id
        : null;

    /* ------------------------------------------------- change future card */
    if (op === "set_payment_method") {
      const paymentMethodId: string = body?.paymentMethodId;
      if (!paymentMethodId) throw new Error("paymentMethodId is required");

      if (scheduleId) {
        await stripe.subscriptionSchedules.update(scheduleId, {
          default_settings: {
            default_payment_method: paymentMethodId,
            collection_method: "charge_automatically",
          },
        });
        const sched = await stripe.subscriptionSchedules.retrieve(scheduleId);
        if (sched.subscription) {
          await stripe.subscriptions.update(
            typeof sched.subscription === "string" ? sched.subscription : sched.subscription.id,
            { default_payment_method: paymentMethodId },
          );
        }
      }

      const { data, error } = await supabase.rpc("pt_plan_set_future_payment_method", {
        p_pass_id: passId,
        p_payment_method_id: paymentMethodId,
        p_brand: body?.brand ?? null,
        p_last4: body?.last4 ?? null,
      });
      if (error) throw error;
      return json({ success: true, stripe_synced: !!scheduleId, ...(data as any) });
    }

    /* --------------------------------------------- move a future due date */
    if (op === "reschedule") {
      const installmentNumber: number = body?.installmentNumber;
      const newDate: string = body?.newDate;
      const mode: string = body?.mode === "future" ? "future" : "one";
      const apply: boolean = body?.apply === true;
      if (installmentNumber == null || !newDate) {
        throw new Error("installmentNumber and newDate are required");
      }

      // Preview first — Storm validates eligibility and returns both schedules.
      const { data: preview, error: prevErr } = await supabase.rpc("pt_plan_reschedule", {
        p_pass_id: passId,
        p_installment_number: installmentNumber,
        p_new_date: newDate,
        p_mode: mode,
        p_apply: false,
        p_reason: body?.reason ?? null,
      });
      if (prevErr) throw prevErr;
      if (!apply) return json({ success: true, ...(preview as any) });

      const { data: applied, error: applyErr } = await supabase.rpc("pt_plan_reschedule", {
        p_pass_id: passId,
        p_installment_number: installmentNumber,
        p_new_date: newDate,
        p_mode: mode,
        p_apply: true,
        p_reason: body?.reason ?? null,
      });
      if (applyErr) throw applyErr;

      // Mirror Storm's dates into Stripe: every remaining unpaid installment
      // becomes its own explicitly dated phase. Collected phases are untouched.
      let stripeSynced = false;
      let stripeNote: string | null = null;
      if (scheduleId) {
        try {
          const sched = await stripe.subscriptionSchedules.retrieve(scheduleId);
          const { data: rows } = await supabase
            .from("pt_payment_plan_installments")
            .select("installment_number, due_date, amount_cents, status")
            .eq("pass_id", passId)
            .gt("installment_number", 0)
            .order("installment_number");

          const upcoming = (rows ?? []).filter((r: any) => r.status === "scheduled");
          const nowSec = Math.floor(Date.now() / 1000);
          const keptPhases = (sched.phases ?? [])
            .filter((p: any) => p.end_date && p.end_date <= nowSec)
            .map((p: any) => ({
              items: p.items.map((it: any) => ({
                price: typeof it.price === "string" ? it.price : it.price.id,
                quantity: it.quantity ?? 1,
              })),
              start_date: p.start_date,
              end_date: p.end_date,
              proration_behavior: "none" as const,
              metadata: p.metadata ?? undefined,
            }));

          const template: any = sched.phases?.[sched.phases.length - 1];
          const unit = pass.frequency_unit || "month";
          const count = pass.frequency_interval || 1;

          const newPhases = upcoming.map((r: any, i: number) => {
            const next = upcoming[i + 1];
            const end = next ? next.due_date : addInterval(r.due_date, unit, count);
            return {
              items: template.items.map((it: any) => ({
                price: typeof it.price === "string" ? it.price : it.price.id,
                quantity: it.quantity ?? 1,
              })),
              start_date: detroitNoonEpoch(r.due_date),
              end_date: detroitNoonEpoch(end),
              proration_behavior: "none" as const,
              metadata: template.metadata ?? undefined,
            };
          });

          if (newPhases.length > 0) {
            await stripe.subscriptionSchedules.update(scheduleId, {
              end_behavior: "cancel",
              phases: [...keptPhases, ...newPhases],
            });
            stripeSynced = true;
          }
        } catch (e) {
          stripeNote = e instanceof Error ? e.message : String(e);
        }
      }

      return json({ success: true, stripe_synced: stripeSynced, stripe_note: stripeNote, ...(applied as any) });
    }

    throw new Error(`Unsupported op: ${op}`);
  } catch (e) {
    console.error("pt-manage-plan error:", e);
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 400);
  }
});
