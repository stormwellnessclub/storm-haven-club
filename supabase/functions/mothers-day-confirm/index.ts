// Confirms a Mother's Day Stripe Checkout session — flips voucher to active and returns details.
// Called by the success page (no webhook needed for MVP).
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
    const { session_id } = await req.json();
    if (!session_id) throw new Error("session_id required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ success: false, status: session.payment_status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const { data: voucher } = await supabase
      .from("mothers_day_vouchers")
      .select("*")
      .eq("stripe_session_id", session_id)
      .maybeSingle();
    if (!voucher) throw new Error("Voucher not found for session");

    let updated = voucher;
    if (voucher.status === "pending") {
      const { data: u } = await supabase
        .from("mothers_day_vouchers")
        .update({
          status: "active",
          stripe_payment_intent_id:
            (session.payment_intent as string) ?? voucher.stripe_payment_intent_id,
        })
        .eq("id", voucher.id)
        .select()
        .single();
      if (u) updated = u;

      // Fire confirmation email
      try {
        await supabase.functions.invoke("send-mothers-day-voucher", {
          body: { voucher_id: voucher.id },
        });
      } catch (_e) {
        // non-fatal
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        voucher: {
          code: updated.code,
          buyer_name: updated.buyer_name,
          recipient_name: updated.recipient_name,
          massage_choice: updated.massage_choice,
          massage_duration: updated.massage_duration,
          expires_at: updated.expires_at,
          amount_paid_cents: updated.amount_paid_cents,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
