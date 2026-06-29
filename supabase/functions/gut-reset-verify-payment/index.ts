// Verifies a Stripe Checkout session, marks the purchase paid, and increments spots_taken.
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
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { stripe_session_id } = await req.json();
    if (!stripe_session_id) throw new Error("Missing stripe_session_id");

    const checkout = await stripe.checkout.sessions.retrieve(stripe_session_id);
    if (!checkout) throw new Error("Checkout session not found");

    const { data: purchase, error: pErr } = await supabase
      .from("gut_reset_purchases")
      .select("*")
      .eq("stripe_session_id", stripe_session_id)
      .maybeSingle();
    if (pErr || !purchase) throw new Error("Purchase not found");

    const wasPending = purchase.status === "pending";
    const paid = checkout.payment_status === "paid";

    if (paid && wasPending) {
      await supabase
        .from("gut_reset_purchases")
        .update({
          status: "paid",
          stripe_payment_intent_id:
            typeof checkout.payment_intent === "string"
              ? checkout.payment_intent
              : checkout.payment_intent?.id ?? null,
        })
        .eq("id", purchase.id);

      // Increment spots_taken atomically via a raw update
      await supabase.rpc("increment_gut_reset_spots", { p_session_id: purchase.session_id }).then(
        async (res) => {
          if (res.error) {
            // RPC may not exist yet — fallback to manual update
            const { data: s } = await supabase
              .from("gut_reset_sessions")
              .select("spots_taken")
              .eq("id", purchase.session_id)
              .maybeSingle();
            if (s) {
              await supabase
                .from("gut_reset_sessions")
                .update({ spots_taken: (s.spots_taken ?? 0) + 1 })
                .eq("id", purchase.session_id);
            }
          }
        }
      );
    }

    return new Response(
      JSON.stringify({
        status: paid ? "paid" : checkout.payment_status,
        purchase_id: purchase.id,
        session_id: purchase.session_id,
        option: purchase.option,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
