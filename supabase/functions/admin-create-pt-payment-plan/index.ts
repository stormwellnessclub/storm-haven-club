// Phase 2C.5B2 — sell a PT package on a named payment plan.
//
// Storm owns the dated schedule: it is calculated and stored on the sale intent
// BEFORE any money moves, then mirrored into Stripe with a subscription schedule
// whose phases produce exactly those dates and amounts. No 30-day approximation.
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireStaff } from "../_shared/requireStaff.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Midday America/Detroit for a YYYY-MM-DD business date, as a unix timestamp. */
function detroitNoonEpoch(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map((v) => parseInt(v, 10));
  return Math.floor(Date.UTC(y, m - 1, d, 16, 0, 0) / 1000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireStaff(req, ["super_admin", "admin", "manager"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const {
      userId,
      packId,
      planId = null,
      paymentMethodId,
      activatedAt,
      expiresAt,
      firstAutopayDate = null,
      quantity = 1,
      adminNotes = null,
      testMode = false,
    } = body ?? {};

    if (!userId || !packId || !paymentMethodId || !activatedAt || !expiresAt) {
      throw new Error("userId, packId, paymentMethodId, activatedAt, expiresAt are required");
    }
    if (!planId) throw new Error("A payment plan must be selected");
    if (!firstAutopayDate) throw new Error("A first autopay date is required");
    if (quantity < 1 || quantity > 20) throw new Error("Invalid quantity");

    // Verification-only sandbox route. Never used by the live sell dialog; when it
    // is set the function talks exclusively to Stripe's test account, so no real
    // money can move regardless of which customer or card is referenced.
    const stripeKey = testMode
      ? Deno.env.get("STRIPE_TEST_SECRET_KEY")
      : Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error(testMode ? "STRIPE_TEST_SECRET_KEY not set" : "STRIPE_SECRET_KEY not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: pack, error: packErr } = await supabase
      .from("pt_packs").select("*").eq("id", packId).maybeSingle();
    if (packErr) throw packErr;
    if (!pack) throw new Error("Pack not found");

    const { data: plan, error: planErr } = await supabase
      .from("pt_pack_payment_plans").select("*").eq("id", planId).maybeSingle();
    if (planErr) throw planErr;
    if (!plan) throw new Error("Payment plan not found");
    if (plan.pack_id !== pack.id) throw new Error("Payment plan does not belong to this package");
    if (!plan.is_active) throw new Error("Payment plan is archived");
    if (!testMode && !plan.stripe_price_id) {
      throw new Error("Payment plan has no Stripe price — save it again to sync");
    }

    // In sandbox verification the catalogue's live price id is meaningless, so an
    // equivalent test-account price is minted deterministically from the plan.
    const planInterval = plan.frequency_unit === "week" ? "week" : plan.frequency_unit === "day" ? "day" : "month";
    const planIntervalCount = (plan.frequency_interval ?? 1) as number;
    let basePriceId: string = plan.stripe_price_id as string;
    if (testMode) {
      const testPrice = await stripe.prices.create({
        currency: "usd",
        unit_amount: plan.installment_cents,
        recurring: { interval: planInterval, interval_count: planIntervalCount },
        product_data: { name: `TEST — ${pack.name} · ${plan.name} installment` },
        metadata: { pt_plan_id: plan.id, role: "installment", sandbox: "true" },
      }, { idempotencyKey: `pt_test_price:${plan.id}:${plan.installment_cents}` });
      basePriceId = testPrice.id;
    }



    // Resolve customer stripe id + email
    let email: string | null = null;
    let stripeCustomerId: string | null = null;
    let memberRecordId: string | null = null;

    const { data: m } = await supabase
      .from("members").select("id, email, stripe_customer_id")
      .eq("user_id", userId).maybeSingle();
    if (m) { email = m.email; stripeCustomerId = m.stripe_customer_id; memberRecordId = m.id; }
    if (!email) {
      const { data: nm } = await supabase
        .from("non_member_profiles").select("email, stripe_customer_id")
        .eq("user_id", userId).maybeSingle();
      if (nm) { email = nm.email; stripeCustomerId = stripeCustomerId || (nm as any).stripe_customer_id; }
    }
    if (!stripeCustomerId && email) {
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length > 0) stripeCustomerId = customers.data[0].id;
    }
    if (!stripeCustomerId) throw new Error("No Stripe customer on file for this user");

    // One stable reference per sale attempt — retries reuse it end to end.
    const saleRef: string = body.saleRef ?? crypto.randomUUID();

    const downCents = plan.amount_due_at_sale_cents * quantity;
    const installmentCents = plan.installment_cents * quantity;
    const finalCents = plan.final_installment_cents * quantity;
    const futureCount: number = plan.future_installment_count;
    const totalCents = plan.plan_total_cents * quantity;

    const { error: intentErr } = await supabase.rpc("pt_open_sale_intent_v2", {
      p_idempotency_key: saleRef,
      p_user_id: userId,
      p_pack_id: pack.id,
      p_quantity: quantity,
      p_payment_method: "payment_plan",
      p_activated_at: activatedAt,
      p_expires_at: expiresAt,
      p_notes: adminNotes,
      p_sale_type: "payment_plan",
      p_installment_count: futureCount + 1,
      p_installment_cents: installmentCents,
      p_first_installment_date: firstAutopayDate,
      p_amount_due_today_cents: downCents,
      p_payment_plan_template_id: plan.id,
    });
    if (intentErr) throw intentErr;

    // Storm's authoritative dated schedule — validated and stored before any charge.
    const { data: schedRes, error: schedErr } = await supabase.rpc("pt_attach_plan_schedule", {
      p_idempotency_key: saleRef,
      p_first_autopay: firstAutopayDate,
    });
    if (schedErr) throw schedErr;
    const schedule = (schedRes as any)?.schedule;
    if (!schedule) throw new Error("Payment schedule could not be calculated");
    const scheduleRows: Array<{ installment_number: number; due_date: string; amount_cents: number }> =
      schedule.installments ?? [];
    const futureRows = scheduleRows.filter((r) => r.installment_number > 0);

    // 1) Amount due at sale — its own payment intent, idempotent on the sale ref.
    let downPaymentIntentId: string | null = null;
    if (downCents > 0) {
      const pi = await stripe.paymentIntents.create({
        amount: downCents,
        currency: "usd",
        customer: stripeCustomerId,
        payment_method: paymentMethodId,
        confirm: true,
        off_session: true,
        description: `Personal Training: ${quantity} × ${pack.name} — ${plan.name} (due at sale)`,
        metadata: {
          type: "pt_payment_plan_down_payment",
          pt_pack_id: pack.id,
          pt_plan_id: plan.id,
          user_id: userId,
          member_id: memberRecordId ?? "",
          pt_sale_ref: saleRef,
        },
      }, { idempotencyKey: `pt_plan_down:${saleRef}` });
      if (pi.status !== "succeeded") throw new Error(`Card was not charged (status: ${pi.status})`);
      downPaymentIntentId = pi.id;
    }

    await supabase.rpc("pt_record_sale_payment", {
      p_idempotency_key: saleRef,
      p_stripe_payment_intent_id: downPaymentIntentId ?? `pt_plan:${saleRef}`,
      p_amount_cents: downCents,
    });

    // 2) Future installments — a subscription schedule starting on the chosen date.
    //    Phases mirror Storm's amounts exactly; the last installment may differ by
    //    the rounding remainder, so it gets its own phase when it does.
    const planMeta: Record<string, string> = {
      type: "pt_payment_plan",
      pt_pack_id: pack.id,
      pt_plan_id: plan.id,
      installment_total: String(futureCount + 1),
      user_id: userId,
      member_id: memberRecordId ?? "",
      sold_by: auth.userId,
      quantity: String(quantity),
      pt_sale_ref: saleRef,
    };

    const interval = planInterval;
    const intervalCount = planIntervalCount;

    let finalPriceId = basePriceId;
    if (finalCents !== installmentCents) {
      const basePrice = await stripe.prices.retrieve(basePriceId);
      const created = await stripe.prices.create({
        product: typeof basePrice.product === "string" ? basePrice.product : (basePrice.product as any).id,
        currency: "usd",
        unit_amount: plan.final_installment_cents,
        recurring: { interval, interval_count: intervalCount },
        metadata: { pt_plan_id: plan.id, role: "final_installment" },
      }, { idempotencyKey: `pt_plan_final_price:${testMode ? "test:" : ""}${plan.id}:${plan.final_installment_cents}` });
      finalPriceId = created.id;
    }

    // Phase metadata is copied onto the subscription when the phase starts. Without
    // it the installment invoice reaches the webhook looking like a membership
    // invoice and never reaches the PT reconciliation branch.
    const phases: any[] = [];
    if (futureCount > 1) {
      phases.push({
        items: [{ price: basePriceId, quantity }],
        iterations: futureCount - 1,
        proration_behavior: "none",
        metadata: planMeta,
      });
    }
    if (futureCount >= 1) {
      phases.push({
        items: [{ price: finalPriceId, quantity }],
        iterations: 1,
        proration_behavior: "none",
        metadata: planMeta,
      });
    }

    let stripeScheduleId: string | null = null;
    if (phases.length > 0) {
      const sched = await stripe.subscriptionSchedules.create({
        customer: stripeCustomerId,
        start_date: detroitNoonEpoch(futureRows[0].due_date),
        end_behavior: "cancel",
        default_settings: {
          default_payment_method: paymentMethodId,
          collection_method: "charge_automatically",
        },
        phases,
        metadata: planMeta,
      }, { idempotencyKey: `pt_plan_sched:${saleRef}` });
      stripeScheduleId = sched.id;
    }

    // 3) Finalize the sold package(s) through the sanctioned path.
    const { data: finalizeRes, error: finalizeErr } = await supabase.rpc("pt_finalize_package_sale", {
      p_idempotency_key: saleRef,
      p_actor: auth.userId === "service_role" ? null : auth.userId,
    });
    if (finalizeErr) throw finalizeErr;
    const passIds = ((finalizeRes as any)?.pass_ids ?? []) as string[];
    if (passIds.length === 0) throw new Error("Package finalization returned no packages");

    const { error: linkErr } = await supabase.rpc("pt_link_payment_plan", {
      p_pass_ids: passIds,
      p_subscription_id: stripeScheduleId ?? `pt_plan:${saleRef}`,
      p_total_installments: futureCount + 1,
      p_installments_paid: 1,
      p_installment_cents: installmentCents,
      p_total_cents: totalCents,
      p_next_payment_date: futureRows[0]?.due_date ?? null,
      p_status: "active",
    });
    if (linkErr) console.error("Failed to link payment plan:", linkErr.message);

    // 4) Materialize Storm's dated installment rows onto the sold agreement.
    const { error: matErr } = await supabase.rpc("pt_materialize_plan_installments", {
      p_idempotency_key: saleRef,
      p_subscription_id: stripeScheduleId,
    });
    if (matErr) console.error("Failed to materialize installments:", matErr.message);

    // Record which card the future installments will be collected on, so staff
    // see the real card on the schedule instead of guessing from the default.
    try {
      const pmDetails = await stripe.paymentMethods.retrieve(paymentMethodId);
      await supabase
        .from("pt_payment_plan_installments")
        .update({
          payment_method_id: paymentMethodId,
          payment_method_brand: pmDetails.card?.brand ?? null,
          payment_method_last4: pmDetails.card?.last4 ?? null,
        })
        .in("pass_id", passIds)
        .in("status", ["scheduled", "paid"]);
    } catch (e) {
      console.error("Could not stamp card on installments:", (e as Error).message);
    }


    return new Response(
      JSON.stringify({
        success: true,
        sale_ref: saleRef,
        schedule_id: stripeScheduleId,
        pass_ids: passIds,
        schedule,
        charged_today_cents: downCents,
        total_cents: totalCents,
        final_payment_date: schedule.final_payment_date,
        first_autopay_date: schedule.first_autopay_date,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("admin-create-pt-payment-plan error:", e);
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
