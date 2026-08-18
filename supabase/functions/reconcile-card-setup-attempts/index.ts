// Repairs `card_setup_attempts` rows whose status drifted from Stripe.
//
// Rows are created as `initiated` when an applicant opens the card step. They
// are supposed to flip to `succeeded` via the client callback / stripe-webhook,
// but that update is lost whenever the tab closes at the wrong moment. The
// result is people who genuinely saved a card being filed as "abandoned".
//
// This reads the real SetupIntent from Stripe for every open row and writes
// back the true status plus card brand / last4.
//
// Callers: nightly cron (internal task token) and staff from the admin
// Abandoned Applications tab.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireTrustedCaller } from "../_shared/requireTrustedCaller.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-task-token, x-internal-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

const log = (step: string, details?: unknown) =>
  console.log(`[RECONCILE-CARD-SETUP] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  const trusted = await requireTrustedCaller(req, [
    "super_admin",
    "admin",
    "manager",
    "front_desk",
  ]);
  if (!trusted.ok) return trusted.response;

  let dryRun = false;
  try {
    const body = await req.json();
    dryRun = body?.dryRun === true;
  } catch {
    /* no body — cron */
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
    apiVersion: "2025-08-27.basil",
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    const { data: rows, error } = await supabase
      .from("card_setup_attempts")
      .select("id, stripe_setup_intent, stripe_customer_id, status, created_at")
      .in("status", ["initiated", "abandoned"])
      .not("stripe_setup_intent", "is", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    let updated = 0;
    const outcomes: Array<Record<string, unknown>> = [];

    for (const row of rows ?? []) {
      let si: Stripe.SetupIntent;
      try {
        si = await stripe.setupIntents.retrieve(row.stripe_setup_intent as string, {
          expand: ["payment_method"],
        });
      } catch (e) {
        log("setup_intent_fetch_failed", { id: row.id, message: String(e) });
        continue;
      }

      let nextStatus: string;
      if (si.status === "succeeded") nextStatus = "succeeded";
      else if (si.status === "canceled") nextStatus = "abandoned";
      else if (si.last_setup_error) nextStatus = "failed";
      else nextStatus = "abandoned";

      const pm = (typeof si.payment_method === "object" ? si.payment_method : null) as
        | Stripe.PaymentMethod
        | null;

      const update: Record<string, unknown> = { status: nextStatus };
      if (nextStatus === "succeeded") {
        update.completed_at = new Date(si.created * 1000).toISOString();
        if (pm?.card) {
          update.card_brand = pm.card.brand;
          update.card_last4 = pm.card.last4;
        }
      }
      if (si.last_setup_error) {
        update.decline_code = si.last_setup_error.decline_code ?? si.last_setup_error.code ?? null;
        update.decline_message = si.last_setup_error.message ?? null;
      }

      outcomes.push({
        id: row.id,
        from: row.status,
        to: nextStatus,
        stripe_status: si.status,
      });

      if (!dryRun && nextStatus !== row.status) {
        const { error: upErr } = await supabase
          .from("card_setup_attempts")
          .update(update)
          .eq("id", row.id);
        if (upErr) {
          log("update_failed", { id: row.id, message: upErr.message });
          continue;
        }
        updated++;
      }
    }

    log("done", { scanned: rows?.length ?? 0, updated, dryRun });
    return new Response(
      JSON.stringify({ success: true, scanned: rows?.length ?? 0, updated, dryRun, outcomes }),
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error("[RECONCILE-CARD-SETUP] error", err);
    return new Response(JSON.stringify({ error: "Reconcile failed" }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
});
