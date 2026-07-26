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

    // Insert pass rows first (so we have ids for metadata)
    const rows = Array.from({ length: quantity }).map(() => ({
      user_id: userId,
      pack_id: pack.id,
      format: pack.format,
      pack_name: pack.name,
      sessions_total: pack.sessions,
      sessions_remaining: pack.sessions,
      price_cents_charged: pack.price_cents,
      activated_at: activatedAt,
      expires_at: expiresAt,
      status: "active",
      payment_method: "payment_plan",
      sold_by_admin_id: auth.userId === "service_role" ? null : auth.userId,
      notes: adminNotes,
      payment_plan_total_installments: months,
      payment_plan_installments_paid: 0,
      payment_plan_status: "active",
    }));
    const { data: insertedPasses, error: insertErr } = await supabase
      .from("pt_passes")
      .insert(rows)
      .select("id");
    if (insertErr) throw insertErr;

    const passIds = (insertedPasses ?? []).map((r: any) => r.id);

    // Create subscription. Charge first invoice immediately with saved PM.
    // Use billing_cycle_anchor = now (default) and cancel_at = now + months*30 days approx
    // to enforce N cycles. Prefer schedule via `cancel_at` computed from period end after first invoice.
    // Simpler and reliable: create subscription then set cancel_at via API call to sub.current_period_end + (months-1)*month.
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
        pt_pass_ids: passIds.join(","),
        installment_total: String(months),
        user_id: userId,
        member_id: memberRecordId ?? "",
        sold_by: auth.userId,
        quantity: String(quantity),
      },
    });

    // Schedule auto-cancel after N cycles.
    // current_period_end == end of installment #1. cancel_at = period_end + (months-1)*avg month secs.
    try {
      const periodEnd = subscription.current_period_end;
      if (periodEnd && months > 1) {
        const cancelAt = periodEnd + (months - 1) * 30 * 24 * 3600;
        await stripe.subscriptions.update(subscription.id, { cancel_at: cancelAt });
      } else if (months === 1) {
        await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: true });
      }
    } catch (e) {
      console.error("Failed to schedule cancel_at:", (e as Error).message);
    }

    // Save subscription id on each pass
    await supabase
      .from("pt_passes")
      .update({
        payment_plan_subscription_id: subscription.id,
        payment_plan_installments_paid: 1, // first invoice charged
      })
      .in("id", passIds);

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
