// Creates a Stripe Checkout session for a Body Roller presale purchase (member presale options need an active member; non-member options are regular price).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSignedInUser, trustedOrigin } from "../_shared/security.ts";
import { PRESALE_OPTIONS, presaleTotals } from "../_shared/bodyRollerPresale.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await getSignedInUser(req);
    if (!user) return json({ error: "Please sign in to reserve." }, 401);

    const { option } = await req.json().catch(() => ({}));
    const opt = PRESALE_OPTIONS[String(option)];
    if (!opt) return json({ error: "Invalid option" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const { data: settings } = await supabase.from("body_roller_presale_settings").select("ends_at").eq("id", 1).maybeSingle();
    if (settings && new Date(settings.ends_at).getTime() < Date.now()) return json({ error: "The presale has ended." }, 400);

    // Server-side member verification — client flags are ignored.
    const { data: members } = await supabase
      .from("members").select("id, first_name, last_name, email, status, user_id")
      .or(`user_id.eq.${user.id},email.ilike.${user.email}`);
    const member: any = (members ?? []).find((m: any) => m.status === "active") ?? null;
    if (opt.audience === "member" && !member) return json({ error: "Member presale pricing is for active members. Non-members can reserve at the regular price." }, 403);
    if (opt.audience === "non_member" && member) return json({ error: "As an active member, please use member presale pricing." }, 400);

    const t = presaleTotals(opt.cents);
    let name: string | null = member ? [member.first_name, member.last_name].filter(Boolean).join(" ") || null : null;
    if (!name) {
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
      name = (prof as any)?.full_name ?? null;
    }

    const { data: purchase, error: insErr } = await supabase.from("body_roller_presale_purchases").insert({
      user_id: user.id, member_id: member?.id ?? null, customer_email: user.email, customer_name: name,
      option_key: option, label: opt.label, duration_minutes: opt.duration, sessions_total: opt.sessions,
      subtotal_cents: t.subtotal, tax_cents: t.tax, fee_cents: t.fee, total_cents: t.total, status: "pending",
    }).select().single();
    if (insErr) throw insErr;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const origin = trustedOrigin(req);
    const meta = { purchase_id: purchase.id, type: "body_roller_presale", option: String(option) };

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customers.data[0]?.id,
      customer_email: customers.data[0] ? undefined : user.email,
      line_items: [
        { price: opt.price_id, quantity: 1 },
        { price_data: { currency: "usd", unit_amount: t.tax, product_data: { name: "Michigan Sales Tax (6%)" } }, quantity: 1 },
        { price_data: { currency: "usd", unit_amount: t.fee, product_data: { name: "Card Processing Fee" } }, quantity: 1 },
      ],
      success_url: `${origin}/body-roller-presale?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/body-roller-presale?cancelled=1`,
      metadata: meta,
      payment_intent_data: { description: `Body Roller Presale — ${opt.label}`, metadata: meta },
    });

    await supabase.from("body_roller_presale_purchases").update({ stripe_session_id: checkout.id }).eq("id", purchase.id);
    return json({ url: checkout.url });
  } catch (e: any) {
    console.error("[body-roller-presale-checkout]", e);
    return json({ error: e?.message ?? "Checkout failed" }, 400);
  }
});
