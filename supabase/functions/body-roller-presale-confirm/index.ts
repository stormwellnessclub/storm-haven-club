// Verifies a Body Roller presale Checkout session and marks the purchase paid (6-month expiry).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSignedInUser } from "../_shared/security.ts";

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
    if (!user) return json({ error: "Not signed in" }, 401);
    const { session_id } = await req.json().catch(() => ({}));
    if (typeof session_id !== "string" || !session_id.startsWith("cs_")) return json({ error: "Missing session" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: p } = await supabase.from("body_roller_presale_purchases").select("*").eq("stripe_session_id", session_id).maybeSingle();
    if (!p || p.user_id !== user.id) return json({ error: "Purchase not found" }, 404);
    if (p.status === "paid") return json({ status: "paid", label: p.label, expires_at: p.expires_at });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const cs = await stripe.checkout.sessions.retrieve(session_id);
    if (cs.payment_status !== "paid") return json({ status: cs.payment_status });

    const paidAt = new Date();
    const expires = new Date(paidAt); expires.setMonth(expires.getMonth() + 6);
    await supabase.from("body_roller_presale_purchases").update({
      status: "paid", paid_at: paidAt.toISOString(), expires_at: expires.toISOString(),
      stripe_payment_intent_id: typeof cs.payment_intent === "string" ? cs.payment_intent : cs.payment_intent?.id ?? null,
    }).eq("id", p.id).eq("status", "pending");
    return json({ status: "paid", label: p.label, expires_at: expires.toISOString() });
  } catch (e: any) {
    return json({ error: e?.message ?? "Confirm failed" }, 400);
  }
});
