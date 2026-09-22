// Create/refresh a Stripe recurring Price for a PT pack payment plan.
// Accepts either { plan_id } (named plan on pt_pack_payment_plans — current)
// or { pack_id } (deprecated single-shape plan on pt_packs).
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireStaff } from "../_shared/requireStaff.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const INTERVAL: Record<string, { interval: "month" | "week"; interval_count: number }> = {
  monthly: { interval: "month", interval_count: 1 },
  weekly: { interval: "week", interval_count: 1 },
  biweekly: { interval: "week", interval_count: 2 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireStaff(req);
  if (!auth.ok) return auth.response;

  try {
    const { pack_id, plan_id } = await req.json();
    if (!pack_id && !plan_id) throw new Error("pack_id or plan_id is required");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // ---------- Named plan path ----------
    if (plan_id) {
      const { data: plan, error: planErr } = await supabase
        .from("pt_pack_payment_plans")
        .select("*")
        .eq("id", plan_id)
        .maybeSingle();
      if (planErr) throw planErr;
      if (!plan) throw new Error("Payment plan not found");

      const { data: pack, error: packErr } = await supabase
        .from("pt_packs").select("*").eq("id", plan.pack_id).maybeSingle();
      if (packErr) throw packErr;
      if (!pack) throw new Error("Package not found");

      const productId = await ensureProduct(stripe, pack);

      if (plan.stripe_price_id) {
        try { await stripe.prices.update(plan.stripe_price_id, { active: false }); } catch (_e) { /* ignore */ }
      }

      const recurring = INTERVAL[plan.frequency] ?? INTERVAL.monthly;
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: plan.installment_cents,
        currency: "usd",
        recurring,
        nickname: `${pack.name} — ${plan.name}`,
        metadata: {
          pt_pack_id: pack.id,
          pt_plan_id: plan.id,
          installment_total: String(plan.installment_count),
        },
      });

      await supabase
        .from("pt_pack_payment_plans")
        .update({ stripe_price_id: price.id })
        .eq("id", plan.id);

      return new Response(
        JSON.stringify({ ok: true, price_id: price.id, installment_cents: plan.installment_cents }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---------- Deprecated pack-level path ----------
    const { data: pack, error: packErr } = await supabase
      .from("pt_packs")
      .select("*")
      .eq("id", pack_id)
      .maybeSingle();
    if (packErr) throw packErr;
    if (!pack) throw new Error("Pack not found");

    if (!pack.allow_payment_plan || !pack.payment_plan_months || pack.payment_plan_months < 2) {
      if (pack.payment_plan_stripe_price_id) {
        await supabase
          .from("pt_packs")
          .update({ payment_plan_stripe_price_id: null })
          .eq("id", pack_id);
      }
      return new Response(JSON.stringify({ ok: true, price_id: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const months = pack.payment_plan_months;
    const monthlyCents = Math.ceil(pack.price_cents / months);
    const productId = await ensureProduct(stripe, pack);

    if (pack.payment_plan_stripe_price_id) {
      try { await stripe.prices.update(pack.payment_plan_stripe_price_id, { active: false }); } catch (_e) { /* ignore */ }
    }

    const price = await stripe.prices.create({
      product: productId,
      unit_amount: monthlyCents,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { pt_pack_id: pack.id, installment_total: String(months) },
    });

    await supabase
      .from("pt_packs")
      .update({ payment_plan_stripe_price_id: price.id })
      .eq("id", pack_id);

    return new Response(
      JSON.stringify({ ok: true, price_id: price.id, monthly_cents: monthlyCents, months }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sync-pt-pack-plan-price error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function ensureProduct(stripe: Stripe, pack: any): Promise<string> {
  const existing = await stripe.products.search({
    query: `metadata['pt_pack_id']:'${pack.id}' AND active:'true'`,
    limit: 1,
  }).catch(() => ({ data: [] as Stripe.Product[] }));
  if (existing.data.length > 0) return existing.data[0].id;
  const product = await stripe.products.create({
    name: `PT Payment Plan — ${pack.name}`,
    metadata: { pt_pack_id: pack.id, pt_format: pack.format },
  });
  return product.id;
}
