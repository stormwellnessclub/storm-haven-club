// Sweeps stale "pending" event tickets to "abandoned".
// For each swept ticket:
//  - Retrieves the Stripe PaymentIntent (if any) to record why it was abandoned
//    (never_entered_card / declined:<msg> / 3ds_abandoned / other).
//  - Cancels the PaymentIntent when it is still cancelable so it doesn't sit in
//    Stripe's "Incomplete" list for 24h.
// Auth: staff only (super_admin/admin/manager) or callable from cron with service role.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireStaff } from "../_shared/requireStaff.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STALE_MS = 30 * 60 * 1000; // 30 minutes

function classifyPaymentIntent(pi: Stripe.PaymentIntent | null): string {
  if (!pi) return "no_payment_intent";
  const err = (pi as any).last_payment_error;
  if (err?.message || err?.code) {
    const label = err.code || err.decline_code || "declined";
    return `declined:${label}`;
  }
  switch (pi.status) {
    case "requires_payment_method":
      return "never_entered_card";
    case "requires_action":
    case "requires_confirmation":
      return "3ds_abandoned";
    case "canceled":
      return "canceled";
    case "processing":
      return "processing";
    default:
      return pi.status || "other";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const gate = await requireStaff(req);
  if (!gate.ok) return gate.response;

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const body = await req.json().catch(() => ({} as any));
    const eventId: string | undefined = body?.event_id;

    const cutoff = new Date(Date.now() - STALE_MS).toISOString();
    let q = supabase
      .from("event_tickets")
      .select("id, stripe_payment_intent_id, event_id")
      .eq("status", "pending")
      .lt("created_at", cutoff);
    if (eventId) q = q.eq("event_id", eventId);
    const { data: stale, error: selErr } = await q;
    if (selErr) throw selErr;

    const results = await Promise.allSettled(
      (stale ?? []).map(async (row: any) => {
        let reason = "no_payment_intent";
        if (row.stripe_payment_intent_id) {
          try {
            const pi = await stripe.paymentIntents.retrieve(row.stripe_payment_intent_id);
            reason = classifyPaymentIntent(pi);
            const cancelable = [
              "requires_payment_method",
              "requires_confirmation",
              "requires_action",
              "processing",
            ].includes(pi.status);
            if (cancelable) {
              try {
                await stripe.paymentIntents.cancel(row.stripe_payment_intent_id, {
                  cancellation_reason: "abandoned",
                });
              } catch (_) {
                /* already canceled or terminal — ignore */
              }
            }
          } catch (e) {
            reason = "stripe_lookup_failed";
          }
        }
        await supabase
          .from("event_tickets")
          .update({
            status: "abandoned",
            abandon_reason: reason,
            abandoned_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        return { id: row.id, reason };
      }),
    );

    const swept = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - swept;

    return new Response(
      JSON.stringify({ ok: true, swept, failed, total: results.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
