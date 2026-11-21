// Starts a Stripe Checkout for a Seasonal Edit class package. Eligibility is
// checked on the server; the webhook issues credits (and the day pass) once paid.
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSignedInUser, trustedOrigin } from "../_shared/security.ts";
import { processingFeeCents } from "../_shared/seasonalClassOffers.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown) => new Response(JSON.stringify(b), { headers: { ...cors, "Content-Type": "application/json" }, status: 200 });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const user = await getSignedInUser(req);
    if (!user) return json({ success: false, error: "Please sign in to continue." });
    const body = await req.json().catch(() => ({}));
    const key = typeof body.offerKey === "string" ? body.offerKey : "";
    if (!/^[a-z_]{3,40}$/.test(key)) return json({ success: false, error: "Unknown package." });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: reason, error: rErr } = await supabase.rpc("seasonal_class_offer_block_reason", { _user_id: user.id, _email: user.email, _key: key });
    if (rErr) throw rErr;
    if (reason) return json({ success: false, error: reason });
    const { data: offer } = await supabase.from("seasonal_class_offers").select("*").eq("key", key).single();

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const found = await stripe.customers.list({ email: user.email, limit: 1 });
    const customer = found.data[0]?.id ?? (await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } })).id;

    const label = `${offer.name} — ${offer.classes} group fitness classes${offer.includes_day_pass ? " + 1 club day pass" : ""}${offer.guest_class_credits ? ` + ${offer.guest_class_credits} guest class` : ""}${offer.cafe_credit_cents ? ` + $${(offer.cafe_credit_cents / 100).toFixed(0)} café credit` : ""} (The Seasonal Edit)`;
    const fee = processingFeeCents(offer.price_cents);
    const origin = trustedOrigin(req);
    const session = await stripe.checkout.sessions.create({
      customer,
      mode: "payment",
      line_items: [
        { price_data: { currency: "usd", unit_amount: offer.price_cents, product_data: { name: label } }, quantity: 1 },
        { price_data: { currency: "usd", unit_amount: fee, product_data: { name: "Payment processing fee" } }, quantity: 1 },
      ],
      payment_intent_data: { description: label, metadata: { type: "seasonal_class_pack", offer_key: key, user_id: user.id } },
      success_url: `${origin}/seasonal-edit?movement=done&session_id={CHECKOUT_SESSION_ID}#movement-edit`,
      cancel_url: `${origin}/seasonal-edit#movement-edit`,
      metadata: { type: "seasonal_class_pack", offer_key: key, user_id: user.id },
    });
    try {
      await supabase.from("pending_class_pass_checkouts").insert({
        user_id: user.id, email: user.email, stripe_session_id: session.id, product_kind: "seasonal_class_pack",
        category: "pilates_cycling", pass_type: key, is_member: false, amount_cents: offer.price_cents, status: "pending",
      });
    } catch (_) { /* tracking only */ }
    return json({ success: true, url: session.url });
  } catch (e) {
    console.error("[seasonal-class-checkout]", e);
    return json({ success: false, error: "We couldn't start checkout. Please try again." });
  }
});
