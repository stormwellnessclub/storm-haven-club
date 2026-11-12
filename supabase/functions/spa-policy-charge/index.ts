// Charges an owed spa late-cancellation or no-show item (spa_policy_charges) to the client's saved card.
// Rows are created only by the record_spa_policy_charge database trigger; this function never decides
// what is owed. Clients may trigger their own late-cancel charge right after cancelling; staff may charge
// any owed or failed item. Declines return HTTP 200 with success: false.
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { selectChargePaymentMethod } from "../_shared/paymentMethods.ts";
import { recordManualCharge } from "../_shared/manualChargeLedger.ts";
import { STAFF_ROLES, canCharge, chargeLabel, processingFeeCents } from "./policy.ts";

const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function whenLabel(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const hr = ((h + 11) % 12) + 1;
  return `${day} at ${hr}:${String(mi).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ success: false, error: "Method not allowed" }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const token = req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
    const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    const caller = auth?.user;
    if (!caller) return reply({ success: false, error: "Please sign in." }, 401);

    const b = await req.json().catch(() => ({}));
    const chargeId = b.chargeId ? String(b.chargeId) : null;
    const appointmentId = b.appointmentId ? String(b.appointmentId) : null;
    if ((chargeId && !uuid.test(chargeId)) || (appointmentId && !uuid.test(appointmentId)) || (!chargeId && !appointmentId)) {
      return reply({ success: false, error: "Missing charge." }, 400);
    }

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", caller.id);
    const isStaff = (roles ?? []).some((r: { role: string }) => STAFF_ROLES.includes(r.role));

    let q = admin.from("spa_policy_charges").select("*").in("status", ["owed", "failed"]);
    q = chargeId ? q.eq("id", chargeId) : q.eq("appointment_id", appointmentId).eq("kind", "late_cancel");
    const { data: charge } = await q.maybeSingle();
    if (!charge) return reply({ success: true, charged: false, none: true });
    if (!canCharge(charge, caller.id, isStaff)) return reply({ success: false, error: "Not allowed." }, 403);
    if (!charge.user_id) return reply({ success: false, error: "This appointment has no client account to charge. Please collect at the desk." });

    // Lock the row so repeat taps or two staff can never charge twice.
    const { data: locked } = await admin.from("spa_policy_charges").update({ status: "charging", updated_at: new Date().toISOString() })
      .eq("id", charge.id).in("status", ["owed", "failed"]).select("id").maybeSingle();
    if (!locked) return reply({ success: true, charged: false, none: true });

    const fail = async (msg: string) => {
      await admin.from("spa_policy_charges").update({ status: "failed", last_error: msg, updated_at: new Date().toISOString() }).eq("id", charge.id);
      return reply({ success: false, error: msg });
    };

    const [{ data: appt }, { data: member }, { data: nm }] = await Promise.all([
      admin.from("spa_appointments").select("service_name, appointment_date, appointment_time").eq("id", charge.appointment_id).single(),
      admin.from("members").select("id, stripe_customer_id").eq("user_id", charge.user_id).not("stripe_customer_id", "is", null).limit(1).maybeSingle(),
      admin.from("non_member_profiles").select("stripe_customer_id").eq("user_id", charge.user_id).maybeSingle(),
    ]);
    const customerId: string | null = member?.stripe_customer_id ?? nm?.stripe_customer_id ?? null;
    if (!customerId) return await fail("No card on file.");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2025-08-27.basil" });
    let pm: Stripe.PaymentMethod | null = null;
    try { pm = await selectChargePaymentMethod(stripe, customerId, null); } catch { pm = null; }
    if (!pm) return await fail("No card on file.");

    const amount = charge.amount_cents as number;
    const fee = processingFeeCents(amount);
    const description = chargeLabel(charge.kind, appt?.service_name ?? "Spa", whenLabel(String(appt?.appointment_date ?? ""), String(appt?.appointment_time ?? "00:00")));
    const brand = pm.card?.brand ? pm.card.brand[0].toUpperCase() + pm.card.brand.slice(1) : "Card";
    const attempt = String(b.idempotencyKey ?? crypto.randomUUID()).slice(0, 80);
    let pi: Stripe.PaymentIntent;
    try {
      pi = await stripe.paymentIntents.create({
        amount: amount + fee, currency: "usd", customer: customerId, payment_method: pm.id, off_session: true, confirm: true,
        description: `${description} (includes $${(fee / 100).toFixed(2)} processing fee)`,
        metadata: {
          type: "spa_service", payment_type: "spa_service", ledger: "manual_charges", spa_policy_charge_id: charge.id,
          spa_appointment_id: charge.appointment_id, policy_kind: charge.kind, user_id: charge.user_id, member_id: charge.member_id ?? "",
          base_amount: String(amount), processing_fee: String(fee),
        },
      }, { idempotencyKey: `spa-policy-${charge.id}-${attempt}` });
    } catch (e) {
      // deno-lint-ignore no-explicit-any
      return await fail(`${brand} •••• ${pm.card?.last4 ?? ""} was declined: ${(e as any)?.message ?? "card declined"}`);
    }
    if (pi.status !== "succeeded") {
      await stripe.paymentIntents.cancel(pi.id).catch(() => {});
      return await fail("The bank needs the card holder to confirm this charge.");
    }

    await admin.from("spa_policy_charges").update({
      status: "charged", payment_intent_id: pi.id, processing_fee_cents: fee, charged_at: new Date().toISOString(),
      last_error: null, resolved_by: caller.id, updated_at: new Date().toISOString(),
    }).eq("id", charge.id);
    await recordManualCharge(admin, {
      memberId: charge.member_id ?? member?.id ?? null, userId: charge.user_id, applicationId: null, stripeCustomerId: customerId,
      chargedByUserId: caller.id, amountCents: amount + fee, description: pi.description ?? description, paymentIntentId: pi.id, status: "succeeded",
      metadata: { type: "spa_service", payment_type: "spa_service", line_items: [{ name: description, quantity: 1, unit_price: amount }],
        subtotal_cents: amount, tax_cents: null, processing_fee_cents: fee, card_brand: brand, card_last4: pm.card?.last4 ?? null },
    }).catch((e) => console.error("[spa-policy-charge] ledger row failed", pi.id, e instanceof Error ? e.message : e));

    return reply({ success: true, charged: true, amountCents: amount + fee, brand, last4: pm.card?.last4 ?? null });
  } catch (e) {
    console.error("[spa-policy-charge]", e instanceof Error ? e.message : e);
    return reply({ success: false, error: "Could not reach the payment system. Please try again." }, 500);
  }
});
