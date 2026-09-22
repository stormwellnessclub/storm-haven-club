// Create a Stripe subscription for a PT pack payment plan and grant pass(es) upfront.
// The subscription runs for N monthly charges, then auto-cancels via `cancel_at`.
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireStaff } from "../_shared/requireStaff.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      quantity = 1,
      adminNotes = null,
    } = body ?? {};

    if (!userId || !packId || !paymentMethodId || !activatedAt || !expiresAt) {
      throw new Error("userId, packId, paymentMethodId, activatedAt, expiresAt are required");
    }
    if (quantity < 1 || quantity > 20) throw new Error("Invalid quantity");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Load pack
    const { data: pack, error: packErr } = await supabase
      .from("pt_packs")
      .select("*")
      .eq("id", packId)
      .maybeSingle();
    if (packErr) throw packErr;
    if (!pack) throw new Error("Pack not found");

    // Named plan (current) or the deprecated single-shape plan on the pack.
    let plan: {
      id: string | null;
      name: string;
      installment_count: number;
      down_payment_cents: number;
      installment_cents: number;
      frequency: string;
      stripe_price_id: string;
    };

    if (planId) {
      const { data: row, error: planErr } = await supabase
        .from("pt_pack_payment_plans").select("*").eq("id", planId).maybeSingle();
      if (planErr) throw planErr;
      if (!row) throw new Error("Payment plan not found");
      if (row.pack_id !== pack.id) throw new Error("Payment plan does not belong to this package");
      if (!row.is_active) throw new Error("Payment plan is archived");
      if (!row.stripe_price_id) throw new Error("Payment plan has no Stripe price — save it again to sync");
      plan = {
        id: row.id,
        name: row.name,
        installment_count: row.installment_count,
        down_payment_cents: row.down_payment_cents,
        installment_cents: row.installment_cents,
        frequency: row.frequency,
        stripe_price_id: row.stripe_price_id,
      };
    } else {
      if (!pack.allow_payment_plan || !pack.payment_plan_months || !pack.payment_plan_stripe_price_id) {
        throw new Error("Payment plan not configured for this pack");
      }
      const n = pack.payment_plan_months;
      const each = Math.ceil(pack.price_cents / n);
      plan = {
        id: null,
        name: `${n} Monthly Payments`,
        installment_count: n,
        down_payment_cents: each,
        installment_cents: each,
        frequency: "monthly",
        stripe_price_id: pack.payment_plan_stripe_price_id,
      };
    }

    const months = plan.installment_count;

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

    // Phase 2A: packages are created server-side through the sanctioned,
    // idempotent sale path — never by a direct insert.
    const saleRef = body.saleRef ?? crypto.randomUUID();

    // Phase 2B: the server derives name/format/sessions/price from pt_packs and
    // the amounts from the selected plan — never from the client.
    const downCents = plan.down_payment_cents * quantity;
    const installmentCents = plan.installment_cents * quantity;
    const totalCents = downCents + (months - 1) * installmentCents;


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
      p_installment_count: months,
      p_installment_cents: installmentCents,
    });
    if (intentErr) throw intentErr;

    // The amount due at sale is charged as its own payment so plans with a larger
    // (or smaller) first payment than the installments are expressed exactly.
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
          pt_plan_id: plan.id ?? "",
          user_id: userId,
          member_id: memberRecordId ?? "",
          pt_sale_ref: saleRef,
        },
      }, { idempotencyKey: `pt_plan_down:${saleRef}` });
      if (pi.status !== "succeeded") {
        throw new Error(`Card was not charged (status: ${pi.status})`);
      }
      downPaymentIntentId = pi.id;
    }

    // Remaining installments run on a dedicated subscription that starts one full
    // period after the sale, so the client is never double-charged today.
    const futureCount = Math.max(0, months - 1);
    const firstFuture = addPeriod(new Date(), plan.frequency, 1);
    const lastFuture = addPeriod(new Date(), plan.frequency, futureCount);
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: plan.stripe_price_id, quantity }],
      default_payment_method: paymentMethodId,
      collection_method: "charge_automatically",
      trial_end: Math.floor(firstFuture.getTime() / 1000),
      cancel_at: Math.floor(addPeriod(lastFuture, plan.frequency, 1).getTime() / 1000),
      metadata: {
        type: "pt_payment_plan",
        pt_pack_id: pack.id,
        pt_plan_id: plan.id ?? "",
        installment_total: String(months),
        user_id: userId,
        member_id: memberRecordId ?? "",
        sold_by: auth.userId,
        quantity: String(quantity),
        pt_sale_ref: saleRef,
      },
    }, { idempotencyKey: `pt_plan:${saleRef}` });

    // Record that money is now committed against this sale. If finalization below
    // fails, the sale stays "paid" and appears under "Incomplete PT sales".
    await supabase.rpc("pt_record_sale_payment", {
      p_idempotency_key: saleRef,
      p_stripe_payment_intent_id: downPaymentIntentId ?? subscription.id,
      p_amount_cents: totalCents,
    });

    const { data: finalizeRes, error: finalizeErr } = await supabase.rpc("pt_finalize_package_sale", {
      p_idempotency_key: saleRef,
      p_actor: auth.userId === "service_role" ? null : auth.userId,
    });
    if (finalizeErr) throw finalizeErr;

    const passIds = ((finalizeRes as any)?.pass_ids ?? []) as string[];
    if (passIds.length === 0) throw new Error("Package finalization returned no packages");

    // Phase 2B: plan linkage goes through the sanctioned RPC so the dedicated
    // subscription id, totals and installment schedule are recorded consistently.
    const nextPaymentDate = (subscription as any).current_period_end
      ? new Date((subscription as any).current_period_end * 1000).toISOString().slice(0, 10)
      : null;
    const { error: linkErr } = await supabase.rpc("pt_link_payment_plan", {
      p_pass_ids: passIds,
      p_subscription_id: subscription.id,
      p_total_installments: months,
      p_installments_paid: 1, // first invoice charged
      p_installment_cents: installmentCents,
      p_total_cents: totalCents,
      p_next_payment_date: nextPaymentDate,
      p_status: "active",
    });
    if (linkErr) console.error("Failed to link payment plan:", linkErr.message);

    // Backfill pass ids onto the subscription so webhook installment tracking works.
    try {
      await stripe.subscriptions.update(subscription.id, {
        metadata: {
          type: "pt_payment_plan",
          pt_pack_id: pack.id,
          pt_pass_ids: passIds.join(","),
          installment_total: String(months),
          user_id: userId,
          member_id: memberRecordId ?? "",
          sold_by: auth.userId,
          quantity: String(quantity),
          pt_sale_ref: saleRef,
        },
      });
    } catch (e) {
      console.error("Failed to attach pass ids to subscription:", (e as Error).message);
    }


    return new Response(
      JSON.stringify({
        success: true,
        subscription_id: subscription.id,
        pass_ids: passIds,
        installments: months,
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
