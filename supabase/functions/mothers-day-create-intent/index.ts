// Creates a Stripe PaymentIntent for the Mother's Day Special and inserts a pending voucher row.
// Used by the embedded in-app checkout (no redirect to Stripe Checkout).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GENDERS = new Set(["female", "male", "prefer_not_to_say"]);

interface Body {
  buyer_first_name: string;
  buyer_last_name: string;
  buyer_email: string;
  buyer_phone: string;
  buyer_gender: string;
  is_gift: boolean;
  recipient_first_name?: string | null;
  recipient_last_name?: string | null;
  recipient_email?: string | null;
  recipient_phone?: string | null;
  recipient_gender?: string | null;
  gift_message?: string | null;
  massage_choice: string;
  massage_duration: 60 | 90;
  amount_cents: number;
}

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

    const body: Body = await req.json();

    // ---- Validation ----
    const missing = (v?: string | null) => !v || !String(v).trim();
    if (missing(body.buyer_first_name) || missing(body.buyer_last_name))
      throw new Error("Buyer first and last name are required");
    if (missing(body.buyer_email)) throw new Error("Buyer email is required");
    if (missing(body.buyer_phone)) throw new Error("Buyer phone is required");
    if (!GENDERS.has(body.buyer_gender)) throw new Error("Please select buyer gender");
    if (![60, 90].includes(body.massage_duration)) throw new Error("Invalid massage duration");
    if (missing(body.massage_choice)) throw new Error("Please choose a massage");

    // Resolve price server-side from spa_services — NEVER trust client amount.
    const { data: svc, error: svcErr } = await supabase
      .from("spa_services")
      .select("price")
      .eq("name", body.massage_choice.trim())
      .eq("duration_minutes", body.massage_duration)
      .eq("category", "Massage")
      .eq("is_active", true)
      .maybeSingle();
    if (svcErr || !svc) throw new Error("Invalid massage selection");
    const baseCents = Math.round(Number(svc.price) * 100);
    if (!baseCents || baseCents < 100) throw new Error("Invalid service price");

    // Gross-up the amount so the buyer covers the Stripe processing fee (2.9% + $0.30)
    const totalCents = Math.ceil((baseCents + 30) / 0.971);
    const feeCents = totalCents - baseCents;


    if (body.is_gift) {
      if (missing(body.recipient_first_name) || missing(body.recipient_last_name))
        throw new Error("Recipient first and last name are required");
      if (missing(body.recipient_email)) throw new Error("Recipient email is required");
      if (!GENDERS.has(body.recipient_gender || "")) throw new Error("Please select recipient gender");
    }

    // Optional auth
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

    const buyerFirst = body.buyer_first_name.trim();
    const buyerLast = body.buyer_last_name.trim();
    const buyerName = `${buyerFirst} ${buyerLast}`.trim();
    const recipFirst = body.recipient_first_name?.trim() || null;
    const recipLast = body.recipient_last_name?.trim() || null;
    const recipName = body.is_gift ? `${recipFirst ?? ""} ${recipLast ?? ""}`.trim() || null : null;

    // Insert pending voucher
    const { data: voucher, error: insErr } = await supabase
      .from("mothers_day_vouchers")
      .insert({
        buyer_user_id: buyerUserId,
        buyer_name: buyerName,
        buyer_first_name: buyerFirst,
        buyer_last_name: buyerLast,
        buyer_email: body.buyer_email.trim().toLowerCase(),
        buyer_phone: body.buyer_phone.trim(),
        buyer_gender: body.buyer_gender,
        recipient_name: recipName,
        recipient_first_name: recipFirst,
        recipient_last_name: recipLast,
        recipient_email: body.is_gift ? body.recipient_email?.trim().toLowerCase() : null,
        recipient_phone: body.is_gift ? body.recipient_phone?.trim() || null : null,
        recipient_gender: body.is_gift ? body.recipient_gender : null,
        gift_message: body.is_gift ? body.gift_message?.trim() || null : null,
        massage_choice: body.massage_choice.trim(),
        massage_duration: body.massage_duration,
        amount_paid_cents: totalCents,
        base_amount_cents: baseCents,
        processing_fee_cents: feeCents,
        status: "pending",
      })
      .select()
      .single();
    if (insErr) throw insErr;

    // Find or create Stripe customer (by email)
    let customerId: string | undefined;
    const existing = await stripe.customers.list({ email: body.buyer_email.trim().toLowerCase(), limit: 1 });
    if (existing.data.length) {
      customerId = existing.data[0].id;
    } else {
      const c = await stripe.customers.create({
        email: body.buyer_email.trim().toLowerCase(),
        name: buyerName,
        phone: body.buyer_phone.trim(),
      });
      customerId = c.id;
    }

    const intent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "usd",
      customer: customerId,
      receipt_email: body.buyer_email.trim().toLowerCase(),
      automatic_payment_methods: { enabled: true },
      description: `Mother's Day Special — ${body.massage_choice} (${body.massage_duration} min) + Wet Spa Access`,
      metadata: {
        campaign: "mothers_day_2026",
        voucher_id: voucher.id,
        massage_choice: body.massage_choice,
        massage_duration: String(body.massage_duration),
        is_gift: String(!!body.is_gift),
        recipient_email: body.recipient_email || "",
        base_amount_cents: String(baseCents),
        processing_fee_cents: String(feeCents),
      },
    });

    await supabase
      .from("mothers_day_vouchers")
      .update({ stripe_payment_intent_id: intent.id })
      .eq("id", voucher.id);

    return new Response(
      JSON.stringify({
        client_secret: intent.client_secret,
        payment_intent_id: intent.id,
        voucher_id: voucher.id,
        base_cents: baseCents,
        processing_fee_cents: feeCents,
        total_cents: totalCents,
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
