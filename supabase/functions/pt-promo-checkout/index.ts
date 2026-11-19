// Black Friday PT package checkout (signed-in clients, saved card).
// Price, sessions and sale window come from pt_packs; the package is created through the
// same sale-intent path staff use (pt_open_sale_intent_v2 → pt_record_sale_payment → pt_finalize_package_sale).
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { selectChargePaymentMethod } from "../_shared/paymentMethods.ts";
import { recordManualCharge } from "../_shared/manualChargeLedger.ts";
import { addDaysIso, addMonthsIso, chargeDescription, detroitToday, processingFeeCents, promoBlockReason } from "./rules.ts";

const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ success: false, error: "Method not allowed" }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const token = req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
    const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    const user = auth?.user;
    if (!user) return reply({ success: false, code: "sign_in", error: "Please sign in to buy a package." }, 401);

    const b = await req.json().catch(() => ({}));
    const packId = String(b.packId ?? "");
    const idem = String(b.idempotencyKey ?? "").slice(0, 100);
    const checkOnly = b.checkOnly === true;
    const planId = b.planId == null ? null : String(b.planId);
    if (planId !== null && !uuid.test(planId)) return reply({ success: false, error: "Please choose a payment plan." }, 400);
    if (!uuid.test(packId) || idem.length < 8) return reply({ success: false, error: "Please choose a package." }, 400);

    const email = (user.email ?? "").toLowerCase();
    const { data: blocked } = await admin.from("blocked_persons").select("id").eq("email", email).limit(1);
    if (blocked?.length) return reply({ success: false, error: "Unable to buy online. Please contact the club." });

    const { data: pack } = await admin.from("pt_packs")
      .select("id, name, sessions, price_cents, promo_key, promo_audience, sale_starts_at, sale_ends_at, is_active, expiration_days")
      .eq("id", packId).not("promo_key", "is", null).maybeSingle();
    if (!pack) return reply({ success: false, error: "This offer is no longer available." });

    const { data: isMember } = await admin.rpc("pt_promo_is_member", { p_user: user.id });
    const block = promoBlockReason(pack, !!isMember, new Date());
    if (block) return reply({ success: false, code: "unavailable", error: block });

    const [{ data: member }, { data: nm }] = await Promise.all([
      admin.from("members").select("id, stripe_customer_id").eq("user_id", user.id).neq("status", "cancelled").maybeSingle(),
      admin.from("non_member_profiles").select("stripe_customer_id").eq("user_id", user.id).maybeSingle(),
    ]);
    const customerId: string | null = member?.stripe_customer_id ?? nm?.stripe_customer_id ?? null;
    if (!customerId) return reply({ success: false, code: "card", error: "Please add a card to your account first." });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2025-08-27.basil" });
    let pm: Stripe.PaymentMethod | null;
    try { pm = await selectChargePaymentMethod(stripe, customerId, typeof b.paymentMethodId === "string" ? b.paymentMethodId : null); }
    catch (e) { return reply({ success: false, code: "card", error: e instanceof Error ? e.message : "Card not found." }); }
    if (!pm) return reply({ success: false, code: "card", error: "Please add a card to your account first." });

    if (planId) {
      const { data: plan } = await admin.from("pt_pack_payment_plans")
        .select("id, pack_id, is_active, session_release").eq("id", planId).maybeSingle();
      if (!plan || plan.pack_id !== pack.id || !plan.is_active || !plan.session_release) {
        return reply({ success: false, error: "This payment plan is not available." });
      }
      const today = detroitToday(new Date());
      const firstAutopay = addMonthsIso(today, 1);
      const brandLabel = pm.card?.brand ? pm.card.brand[0].toUpperCase() + pm.card.brand.slice(1) : "Card";
      if (checkOnly) {
        const { data: sched, error: schedErr } = await admin.rpc("pt_build_plan_schedule", {
          p_pack_id: pack.id, p_plan_id: plan.id, p_quantity: 1, p_first_autopay: firstAutopay, p_sale_date: today,
        });
        if (schedErr || !sched) return reply({ success: false, error: "We could not build the payment schedule. Please call the club." });
        // deno-lint-ignore no-explicit-any
        const rows = ((sched as any).installments ?? []).map((r: any, i: number) => ({
          number: i + 1, dueDate: r.due_date, amountCents: r.amount_cents, feeCents: processingFeeCents(r.amount_cents),
          sessions: plan.session_release[i] ?? 0,
        }));
        return reply({ success: true, check: true, plan: true, totalCents: pack.price_cents, rows, brand: brandLabel, last4: pm.card?.last4 ?? null });
      }
      const saleRef = `pt-promo-plan-${idem}`;
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/admin-create-pt-payment-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({
          userId: user.id, packId: pack.id, planId: plan.id, paymentMethodId: pm.id,
          activatedAt: today, expiresAt: addDaysIso(today, pack.expiration_days ?? 365),
          firstAutopayDate: firstAutopay, saleRef, adminNotes: "Bought online — Black Friday sale (payment plan)",
        }),
      });
      // deno-lint-ignore no-explicit-any
      const out: any = await res.json().catch(() => ({}));
      if (out?.success) {
        return reply({ success: true, plan: true, sessions: plan.session_release[0], chargedCents: out.charged_today_cents, brand: brandLabel, last4: pm.card?.last4 ?? null });
      }
      // If the first payment went through but the package was not saved, give the money back.
      const { data: intent } = await admin.from("pt_sale_intents")
        .select("stripe_payment_intent_id, pass_ids").eq("idempotency_key", saleRef).maybeSingle();
      const piId = intent?.stripe_payment_intent_id ?? "";
      if (piId.startsWith("pi_") && !(intent?.pass_ids?.length)) {
        const stripeR = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2025-08-27.basil" });
        await stripeR.refunds.create({ payment_intent: piId }, { idempotencyKey: `pt-promo-plan-refund-${idem}` })
          .catch((e: unknown) => console.error("[pt-promo-checkout] refund failed", piId, e instanceof Error ? e.message : e));
        await admin.rpc("pt_fail_sale_intent", { p_idempotency_key: saleRef, p_error: String(out?.error ?? "plan setup failed") });
        return reply({ success: false, error: "We could not set up your payment plan, so your first payment was refunded. Please try again or call the club." });
      }
      const msg = String(out?.error ?? "");
      if (/declin|card|insufficient|status/i.test(msg)) {
        return reply({ success: false, code: "declined", error: `${brandLabel} •••• ${pm.card?.last4 ?? ""} was declined. Please try another card.` });
      }
      console.error("[pt-promo-checkout] plan failed", msg);
      return reply({ success: false, error: "We could not set up your payment plan. Please try again or call the club." });
    }

    const base = pack.price_cents;
    const fee = processingFeeCents(base);
    const brand = pm.card?.brand ? pm.card.brand[0].toUpperCase() + pm.card.brand.slice(1) : "Card";
    if (checkOnly) {
      return reply({ success: true, check: true, baseCents: base, feeCents: fee, totalCents: base + fee, brand, last4: pm.card?.last4 ?? null });
    }

    const saleKey = `pt-promo-${idem}`;
    const { error: openErr } = await admin.rpc("pt_open_sale_intent_v2", {
      p_idempotency_key: saleKey, p_user_id: user.id, p_pack_id: pack.id, p_quantity: 1,
      p_payment_method: "card_on_file", p_notes: "Bought online — Black Friday sale",
    });
    if (openErr) throw openErr;

    const description = chargeDescription(pack.sessions, !!isMember);
    let pi: Stripe.PaymentIntent;
    try {
      pi = await stripe.paymentIntents.create({
        amount: base + fee, currency: "usd", customer: customerId, payment_method: pm.id, off_session: true, confirm: true,
        description: `${description} (includes $${(fee / 100).toFixed(2)} processing fee)`,
        metadata: { type: "personal_training", payment_type: "personal_training", ledger: "manual_charges",
          pt_pack_id: pack.id, promo: pack.promo_key ?? "", sessions: String(pack.sessions), user_id: user.id,
          member_id: member?.id ?? "", base_amount: String(base), processing_fee: String(fee), pt_sale_key: saleKey },
      }, { idempotencyKey: saleKey });
    } catch (e) {
      // deno-lint-ignore no-explicit-any
      const err = e as any;
      await admin.rpc("pt_fail_sale_intent", { p_idempotency_key: saleKey, p_error: String(err?.message ?? "declined") });
      return reply({ success: false, code: "declined", error: `${brand} •••• ${pm.card?.last4 ?? ""} was declined: ${err?.message ?? "please try another card."}` });
    }
    if (pi.status !== "succeeded") {
      await stripe.paymentIntents.cancel(pi.id).catch(() => {});
      await admin.rpc("pt_fail_sale_intent", { p_idempotency_key: saleKey, p_error: `status ${pi.status}` });
      return reply({ success: false, code: "declined", error: "Your bank needs to confirm this card. Please use another card or call the club." });
    }

    const { error: payErr } = await admin.rpc("pt_record_sale_payment", { p_idempotency_key: saleKey, p_stripe_payment_intent_id: pi.id, p_amount_cents: base });
    const { error: finErr } = payErr ? { error: payErr } : await admin.rpc("pt_finalize_package_sale", { p_idempotency_key: saleKey, p_actor: user.id });
    if (finErr) {
      console.error("[pt-promo-checkout] paid but package not saved", pi.id, finErr.message);
      return reply({ success: false, error: "Your card was charged but we could not add your sessions. Please call the club; we will fix it right away." });
    }

    await recordManualCharge(admin, {
      memberId: member?.id ?? null, userId: user.id, applicationId: null, stripeCustomerId: customerId, chargedByUserId: user.id,
      amountCents: base + fee, description: pi.description ?? description, paymentIntentId: pi.id, status: "succeeded",
      metadata: { type: "personal_training", payment_type: "personal_training", line_items: [{ name: description, quantity: 1, unit_price: base }],
        subtotal_cents: base, tax_cents: null, processing_fee_cents: fee, card_brand: brand, card_last4: pm.card?.last4 ?? null },
    }).catch((e) => console.error("[pt-promo-checkout] ledger row failed", pi.id, e instanceof Error ? e.message : e));

    return reply({ success: true, sessions: pack.sessions, chargedCents: base + fee, brand, last4: pm.card?.last4 ?? null });
  } catch (e) {
    console.error("[pt-promo-checkout]", e instanceof Error ? e.message : e);
    return reply({ success: false, error: "We could not complete the purchase. Your card was not charged. Please try again or call the club." }, 500);
  }
});
