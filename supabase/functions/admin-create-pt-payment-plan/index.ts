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
    if (!pack.allow_payment_plan || !pack.payment_plan_months || !pack.payment_plan_stripe_price_id) {
      throw new Error("Payment plan not configured for this pack");
    }

    const months = pack.payment_plan_months;

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

    // Phase 2B: the server derives name/format/sessions/price from pt_packs.
    const totalCents = pack.price_cents * quantity;
    const installmentCents = Math.ceil(totalCents / months);

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

    // The Stripe subscription is created FIRST so a payment-setup failure can never
    // leave a granted package behind. Stripe and Postgres are separate systems: the
    // sale record is the bridge that makes the flow recoverable.
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: pack.payment_plan_stripe_price_id!, quantity }],
      default_payment_method: paymentMethodId,
      collection_method: "charge_automatically",
      payment_behavior: "error_if_incomplete",
      off_session: true,
      metadata: {
        type: "pt_payment_plan",
        pt_pack_id: pack.id,
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
      p_stripe_payment_intent_id: subscription.id,
      p_amount_cents: pack.price_cents * quantity,
    });

    // Schedule auto-cancel after N cycles.
    try {
      const periodEnd = (subscription as any).current_period_end;
      if (periodEnd && months > 1) {
        const cancelAt = periodEnd + (months - 1) * 30 * 24 * 3600;
        await stripe.subscriptions.update(subscription.id, { cancel_at: cancelAt });
      } else if (months === 1) {
        await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: true });
      }
    } catch (e) {
      console.error("Failed to schedule cancel_at:", (e as Error).message);
    }

    const { data: finalizeRes, error: finalizeErr } = await supabase.rpc("pt_finalize_package_sale", {
      p_idempotency_key: saleRef,
      p_actor: auth.userId === "service_role" ? null : auth.userId,
    });
    if (finalizeErr) throw finalizeErr;

    const passIds = ((finalizeRes as any)?.pass_ids ?? []) as string[];
    if (passIds.length === 0) throw new Error("Package finalization returned no packages");

    await supabase
      .from("pt_passes")
      .update({
        payment_plan_total_installments: months,
        payment_plan_installments_paid: 1, // first invoice charged
        payment_plan_status: "active",
        payment_plan_subscription_id: subscription.id,
      })
      .in("id", passIds);

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
