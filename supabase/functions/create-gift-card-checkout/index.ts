// Creates a Stripe PaymentIntent for an online gift card purchase and inserts a
// PENDING gift_cards row. The card is only activated once payment succeeds
// (see confirm-gift-card-purchase). Requires an authenticated buyer.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MIN_CENTS = 2500;
const MAX_CENTS = 100000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // ---- Auth (required) ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ success: false, error: "Please sign in to buy a gift card" }, 200);
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.slice(7));
    if (userErr || !userData.user) return json({ success: false, error: "Please sign in to buy a gift card" }, 200);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const amountCents = Math.round(Number(body.amountCents));
    const recipientName = String(body.recipientName ?? "").trim();
    const recipientEmail = String(body.recipientEmail ?? "").trim().toLowerCase();
    const customMessage = String(body.customMessage ?? "").trim().slice(0, 500);
    const serviceLabel = body.serviceLabel ? String(body.serviceLabel).trim().slice(0, 120) : null;
    const purchaserName = String(body.purchaserName ?? "").trim().slice(0, 120);
    const scheduledSendAtRaw = body.scheduledSendAt ? String(body.scheduledSendAt) : null;

    // ---- Validation ----
    if (!Number.isFinite(amountCents) || amountCents < MIN_CENTS || amountCents > MAX_CENTS) {
      return json({ success: false, error: `Amount must be between $${MIN_CENTS / 100} and $${MAX_CENTS / 100}` });
    }
    if (!recipientName) return json({ success: false, error: "Recipient name is required" });
    if (!EMAIL_RE.test(recipientEmail)) return json({ success: false, error: "Enter a valid recipient email" });

    let scheduledSendAt: Date | null = null;
    if (scheduledSendAtRaw) {
      const d = new Date(scheduledSendAtRaw);
      if (isNaN(d.getTime())) return json({ success: false, error: "Invalid send date" });
      if (d.getTime() > Date.now() + 60_000) {
        if (d.getTime() > Date.now() + 365 * 24 * 60 * 60 * 1000) {
          return json({ success: false, error: "Send date must be within a year" });
        }
        scheduledSendAt = d;
      }
    }

    const buyerEmail = (user.email ?? "").toLowerCase();

    // Buyer profile / member link (best effort)
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email, phone")
      .eq("user_id", user.id)
      .maybeSingle();
    const { data: member } = await supabase
      .from("members")
      .select("id")
      .ilike("email", buyerEmail)
      .maybeSingle();

    const buyerName =
      purchaserName ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
      buyerEmail;

    // ---- Code + pending row ----
    const { data: codeData, error: codeErr } = await supabase.rpc("generate_gift_card_code");
    if (codeErr) throw codeErr;
    const code = codeData as unknown as string;
    if (!code) throw new Error("Failed to generate gift card code");

    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const { data: card, error: insErr } = await supabase
      .from("gift_cards")
      .insert({
        code,
        amount_cents: amountCents,
        balance_cents: amountCents,
        purchaser_user_id: user.id,
        purchaser_member_id: member?.id ?? null,
        purchaser_name: buyerName,
        purchaser_email: buyerEmail,
        recipient_name: recipientName,
        recipient_email: recipientEmail,
        custom_message: customMessage || null,
        service_label: serviceLabel,
        payment_method: "stripe_online",
        purchase_source: "online",
        status: "pending",
        scheduled_send_at: scheduledSendAt ? scheduledSendAt.toISOString() : null,
        expires_at: expiresAt,
      })
      .select("id, code, amount_cents")
      .single();
    if (insErr) throw insErr;

    // ---- Stripe ----
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    let customerId: string | undefined;
    if (buyerEmail) {
      const existing = await stripe.customers.list({ email: buyerEmail, limit: 1 });
      customerId = existing.data[0]?.id ??
        (await stripe.customers.create({ email: buyerEmail, name: buyerName })).id;
    }

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      customer: customerId,
      receipt_email: buyerEmail || undefined,
      automatic_payment_methods: { enabled: true },
      description: `Storm Wellness Club Gift Card${serviceLabel ? ` — ${serviceLabel}` : ""} ($${(amountCents / 100).toFixed(2)})`,
      metadata: {
        purpose: "gift_card",
        gift_card_id: card.id,
        gift_card_code: card.code,
        recipient_email: recipientEmail,
      },
    });

    await supabase
      .from("gift_cards")
      .update({ stripe_payment_intent_id: intent.id, payment_reference: intent.id })
      .eq("id", card.id);

    return json({
      success: true,
      giftCardId: card.id,
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      totalCents: amountCents,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[CREATE-GIFT-CARD-CHECKOUT] ERROR", msg);
    return json({ success: false, error: msg });
  }
});
