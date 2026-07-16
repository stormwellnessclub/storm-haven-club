// Stripe webhook — source of truth for activating Mother's Day vouchers + sending emails.
// Listens for payment_intent.succeeded and checkout.session.completed.
// Idempotent: only acts on pending vouchers.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const sig = req.headers.get("stripe-signature");
  const secret = Deno.env.get("STRIPE_MOTHERS_DAY_WEBHOOK_SECRET");
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    if (!sig || !secret) {
      // Fail closed — never trust an unsigned/unconfigured webhook.
      return new Response("Webhook signature missing or secret not configured", { status: 400 });
    }
    event = await stripe.webhooks.constructEventAsync(raw, sig, secret);
  } catch (e: any) {
    return new Response(`Webhook signature error: ${e.message}`, { status: 400 });
  }


  const activate = async (intentId: string | null, sessionId: string | null) => {
    let voucher: any = null;
    if (intentId) {
      const { data } = await supabase
        .from("mothers_day_vouchers")
        .select("*")
        .eq("stripe_payment_intent_id", intentId)
        .maybeSingle();
      voucher = data;
    }
    if (!voucher && sessionId) {
      const { data } = await supabase
        .from("mothers_day_vouchers")
        .select("*")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();
      voucher = data;
    }
    if (!voucher) return { skipped: true, reason: "voucher_not_found" };
    if (voucher.status !== "pending") return { skipped: true, reason: `status_${voucher.status}` };

    await supabase
      .from("mothers_day_vouchers")
      .update({
        status: "active",
        stripe_payment_intent_id: intentId ?? voucher.stripe_payment_intent_id,
      })
      .eq("id", voucher.id);

    try {
      await supabase.functions.invoke("send-mothers-day-voucher", {
        body: { voucher_id: voucher.id, triggered_by: "webhook" },
      });
    } catch (_e) {
      // emails are tracked separately; webhook still succeeded
    }
    return { activated: true, voucher_id: voucher.id };
  };

  try {
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      // Only act on Mother's Day intents
      if (pi.metadata?.campaign === "mothers_day_2026" || pi.metadata?.voucher_id) {
        const r = await activate(pi.id, null);
        return new Response(JSON.stringify({ ok: true, ...r }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.metadata?.campaign === "mothers_day_2026" || s.metadata?.voucher_id) {
        const r = await activate((s.payment_intent as string) || null, s.id);
        return new Response(JSON.stringify({ ok: true, ...r }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
