// Finalizes an embedded Stripe PaymentElement event ticket purchase.
// Idempotent: paid tickets stay paid, and confirmation email sending is guarded separately.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { payment_intent_id } = await req.json();
    if (!payment_intent_id || typeof payment_intent_id !== "string") {
      throw new Error("payment_intent_id is required");
    }
    if (!payment_intent_id.startsWith("pi_")) {
      throw new Error("Invalid payment reference");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
    const paid = paymentIntent.status === "succeeded";

    const { data: tickets, error: fetchErr } = await supabase
      .from("event_tickets")
      .select("id, status, event_id, ticket_type, amount_cents, buyer_first_name, buyer_last_name, buyer_email, qr_token, events(title, starts_at, venue)")
      .eq("stripe_payment_intent_id", payment_intent_id);
    if (fetchErr) throw fetchErr;
    if (!tickets || tickets.length === 0) throw new Error("No tickets found for this payment");

    if (paid) {
      await supabase
        .from("event_tickets")
        .update({
          status: "paid",
          stripe_payment_intent_id: paymentIntent.id,
        })
        .eq("stripe_payment_intent_id", payment_intent_id)
        .eq("status", "pending");

      supabase.functions
        .invoke("send-event-ticket-confirmation", { body: { payment_intent_id } })
        .catch((e) => console.error("confirmation email invoke failed:", e?.message || e));
    }

    const { data: fresh } = await supabase
      .from("event_tickets")
      .select("id, status, ticket_type, amount_cents, buyer_first_name, buyer_last_name, buyer_email, qr_token, events(title, starts_at, venue)")
      .eq("stripe_payment_intent_id", payment_intent_id);

    return new Response(JSON.stringify({ paid, tickets: fresh ?? tickets }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    console.error("finalize-event-ticket-payment error:", e?.message || e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});