// Creates a Stripe PaymentIntent for the Mother's Day Class Pack (10-class pack).
// Embedded in-app checkout (no Stripe redirect). Server resolves member vs non-member tier.
// Privacy: never returns or echoes any member data; only a boolean recipient_is_member.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Sale ends Sunday May 11 2026 at 23:59:59 America/Detroit (CDT = UTC-5).
// 2026-05-12T00:00:00 CDT == 2026-05-12T05:00:00Z
const SALE_END_UTC = Date.parse("2026-05-12T05:00:00Z");

const PRICES = {
  member: { id: "price_1TUVcQLyZrsSqLhs5GP06RdZ", amount: 15000, label: "Member" },
  nonMember: { id: "price_1TUVhyLyZrsSqLhsLmKDiIVH", amount: 26500, label: "Non-Member" },
};

interface Body {
  is_gift: boolean;
  buyer_first_name: string;
  buyer_last_name: string;
  buyer_email: string;
  buyer_phone?: string;
  recipient_first_name?: string;
  recipient_last_name?: string;
  recipient_email?: string;
}

const missing = (v?: string | null) => !v || !String(v).trim();
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (Date.now() >= SALE_END_UTC) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "The Mother's Day Class Pack sale has ended.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    if (!stripeKey.startsWith("sk_")) {
      console.error("[mothers-day-pack-create-intent] Stripe secret key missing/invalid", {
        prefix: stripeKey.slice(0, 7),
      });
      return new Response(
        JSON.stringify({ success: false, error: "Payment configuration error. Please try again later." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    console.log("[mothers-day-pack-create-intent] using key prefix:", stripeKey.slice(0, 8));
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body: Body = await req.json();

    if (missing(body.buyer_first_name) || missing(body.buyer_last_name))
      throw new Error("Buyer first and last name are required");
    if (missing(body.buyer_email) || !isEmail(body.buyer_email))
      throw new Error("Valid buyer email is required");

    if (body.is_gift) {
      if (missing(body.recipient_first_name) || missing(body.recipient_last_name))
        throw new Error("Recipient first and last name are required");
      if (missing(body.recipient_email) || !isEmail(body.recipient_email!))
        throw new Error("Valid recipient email is required");
    }

    // Optional auth — capture buyer user id if signed in
    let buyerUserId: string | null = null;
    const auth = req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7);
      const anon = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? ""
      );
      const { data } = await anon.auth.getUser(token);
      if (data?.user) buyerUserId = data.user.id;
    }

    // -------- Server-side tier resolution (no client trust) --------
    // Lookup uses case-insensitive exact email match. Returns ONLY a boolean.
    let recipientIsMember = false;
    let selfIsMember = false;

    const checkMemberByEmail = async (emailRaw: string) => {
      const email = emailRaw.trim();
      if (!email) return false;
      const { data, error } = await supabase
        .from("members")
        .select("id")
        .ilike("email", email) // case-insensitive exact (no wildcards)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (error) return false;
      return !!data;
    };

    if (body.is_gift) {
      recipientIsMember = await checkMemberByEmail(body.recipient_email!);
    } else {
      selfIsMember = await checkMemberByEmail(body.buyer_email);
    }

    const tierIsMember = body.is_gift ? recipientIsMember : selfIsMember;
    const tier = tierIsMember ? PRICES.member : PRICES.nonMember;
    const baseCents = tier.amount;

    // Gross-up processing fee (matches site-wide formula)
    const totalCents = Math.ceil((baseCents + 30) / 0.971);
    const feeCents = totalCents - baseCents;

    const buyerFirst = body.buyer_first_name.trim();
    const buyerLast = body.buyer_last_name.trim();
    const buyerName = `${buyerFirst} ${buyerLast}`.trim();
    const buyerEmail = body.buyer_email.trim().toLowerCase();
    const recipFirst = body.recipient_first_name?.trim() || null;
    const recipLast = body.recipient_last_name?.trim() || null;
    const recipName = body.is_gift ? `${recipFirst ?? ""} ${recipLast ?? ""}`.trim() : null;
    const recipEmail = body.is_gift ? body.recipient_email!.trim().toLowerCase() : null;

    // Find or create Stripe customer
    let customerId: string | undefined;
    const existing = await stripe.customers.list({ email: buyerEmail, limit: 1 });
    if (existing.data.length) customerId = existing.data[0].id;
    else {
      const c = await stripe.customers.create({
        email: buyerEmail,
        name: buyerName,
        phone: body.buyer_phone?.trim() || undefined,
      });
      customerId = c.id;
    }

    const intent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "usd",
      customer: customerId,
      receipt_email: buyerEmail,
      // Card-only: avoid wallets/redirect methods that can fail silently in embedded checkout.
      payment_method_types: ["card"],
      description: `Mother's Day Class Pack — ${tier.label} (10 classes)`,
      metadata: {
        type: "mothers_day_class_pack",
        promo: "mothers_day_2026",
        is_gift: String(!!body.is_gift),
        tier: tierIsMember ? "member" : "nonMember",
        buyer_user_id: buyerUserId ?? "",
        buyer_name: buyerName,
        buyer_email: buyerEmail,
        recipient_name: recipName ?? "",
        recipient_email: recipEmail ?? "",
        base_amount_cents: String(baseCents),
        processing_fee_cents: String(feeCents),
      },
    });

    {
      const { error: pendingErr } = await supabase
        .from("pending_class_pass_checkouts")
        .insert({
          user_id: buyerUserId,
          email: buyerEmail.toLowerCase(),
          name: buyerName,
          stripe_payment_intent_id: intent.id,
          product_kind: "mothers_day_pack",
          is_member: tierIsMember,
          is_gift: !!body.is_gift,
          gift_recipient_email: recipEmail,
          gift_recipient_name: recipName,
          amount_cents: totalCents,
          status: "pending",
        });
      if (pendingErr) {
        // Log loudly so future tracking failures are visible in edge logs.
        console.error("[mothers-day-pack-create-intent] pending insert failed", {
          pi: intent.id,
          error: pendingErr.message,
          code: (pendingErr as any).code,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        client_secret: intent.client_secret,
        payment_intent_id: intent.id,
        tier: tierIsMember ? "member" : "nonMember",
        recipient_is_member: body.is_gift ? recipientIsMember : null,
        base_cents: baseCents,
        processing_fee_cents: feeCents,
        total_cents: totalCents,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
