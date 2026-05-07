// Confirms a Mother's Day Class Pack payment, fulfills the pass, and triggers emails.
// Idempotent on stripe_payment_intent_id (DB-enforced). Safe to invoke from client AND webhook.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROMO = "mothers_day_2026";
const VALIDITY_DAYS = 60;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { payment_intent_id } = await req.json();
    if (!payment_intent_id) throw new Error("payment_intent_id required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const pi = await stripe.paymentIntents.retrieve(payment_intent_id);
    if (pi.status !== "succeeded") {
      return new Response(
        JSON.stringify({ success: false, status: "not_paid" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const m = pi.metadata || {};
    if (m.promo !== PROMO || m.type !== "mothers_day_class_pack") {
      throw new Error("Unexpected payment metadata");
    }

    // Idempotency by PI id
    const { data: existing } = await supabase
      .from("class_passes")
      .select("id, expires_at, gift_recipient_email, gift_recipient_name, is_member_price, gift_buyer_email, gift_buyer_name, user_id")
      .eq("stripe_payment_intent_id", pi.id)
      .maybeSingle();
    if (existing) {
      return new Response(
        JSON.stringify({
          success: true,
          pass_id: existing.id,
          already_fulfilled: true,
          is_gift: !!existing.gift_recipient_email,
          tier: existing.is_member_price ? "member" : "nonMember",
          expires_at: existing.expires_at,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const isGift = m.is_gift === "true";
    const tier = m.tier === "member" ? "member" : "nonMember";
    const buyerUserId = m.buyer_user_id || null;
    const buyerName = m.buyer_name || "";
    const buyerEmail = (m.buyer_email || "").toLowerCase();
    const recipientName = m.recipient_name || null;
    const recipientEmail = (m.recipient_email || "").toLowerCase() || null;
    const baseCents = parseInt(m.base_amount_cents || "0", 10);

    // Resolve target user / member
    let targetUserId: string | null = null;
    let memberId: string | null = null;
    let giftVerificationStatus = "auto";

    const lookupActiveMemberByEmail = async (email: string) => {
      const { data } = await supabase
        .from("members")
        .select("id, user_id")
        .ilike("email", email)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      return data || null;
    };

    if (isGift && recipientEmail) {
      const recipMember = await lookupActiveMemberByEmail(recipientEmail);
      if (recipMember) {
        targetUserId = recipMember.user_id;
        memberId = recipMember.id;
        giftVerificationStatus = "auto";
      } else {
        // Leave user_id NULL — recipient will claim via redeem page or signup trigger
        targetUserId = null;
        giftVerificationStatus = tier === "member" ? "pending" : "auto";
      }
    } else {
      targetUserId = buyerUserId;
      if (buyerEmail) {
        const selfMember = await lookupActiveMemberByEmail(buyerEmail);
        if (selfMember) {
          memberId = selfMember.id;
          if (!targetUserId) targetUserId = selfMember.user_id;
        }
      }
      giftVerificationStatus = tier === "member" && !memberId ? "pending" : "auto";
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + VALIDITY_DAYS);

    const { data: pass, error: insErr } = await supabase
      .from("class_passes")
      .insert({
        user_id: targetUserId,
        member_id: memberId,
        category: "pilates_cycling",
        pass_type: "10-pack",
        classes_total: 10,
        classes_remaining: 10,
        price_paid: baseCents / 100,
        is_member_price: tier === "member",
        status: "active",
        expires_at: expiresAt.toISOString(),
        promo_code: PROMO,
        stripe_payment_intent_id: pi.id,
        gift_buyer_user_id: buyerUserId,
        gift_buyer_name: buyerName,
        gift_buyer_email: buyerEmail,
        gift_recipient_name: recipientName,
        gift_recipient_email: recipientEmail,
        gift_verification_status: giftVerificationStatus,
      })
      .select()
      .single();
    if (insErr) {
      // Race: another invocation just inserted with same PI — return that one
      const { data: race } = await supabase
        .from("class_passes")
        .select("id, expires_at, is_member_price, gift_recipient_email")
        .eq("stripe_payment_intent_id", pi.id)
        .maybeSingle();
      if (race) {
        return new Response(
          JSON.stringify({ success: true, pass_id: race.id, already_fulfilled: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      throw insErr;
    }

    // Fire confirmation emails (non-fatal)
    try {
      await supabase.functions.invoke("send-mothers-day-pack-confirmation", {
        body: { pass_id: pass.id },
      });
    } catch (_e) { /* non-fatal */ }

    return new Response(
      JSON.stringify({
        success: true,
        pass_id: pass.id,
        is_gift: isGift,
        recipient_name: recipientName,
        expires_at: pass.expires_at,
        tier,
        unclaimed: !targetUserId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
