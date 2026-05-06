// Admin tool: reconcile pending vouchers against Stripe.
// For each pending voucher with a stripe_payment_intent_id, check Stripe.
// If succeeded → activate + trigger emails. If never paid → leave as pending.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify caller is admin
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) throw new Error("Not authenticated");
    const anon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data: userData } = await anon.auth.getUser(auth.slice(7));
    const u = userData?.user;
    if (!u) throw new Error("Not authenticated");
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.id);
    const allowed = new Set(["admin", "super_admin", "manager", "front_desk"]);
    if (!(roles || []).some((r: any) => allowed.has(r.role))) throw new Error("Not authorized");

    const { data: pending } = await supabase
      .from("mothers_day_vouchers")
      .select("id, code, stripe_payment_intent_id, stripe_session_id, buyer_email, recipient_email")
      .eq("status", "pending");

    const results: any[] = [];
    for (const v of pending || []) {
      let succeeded = false;
      try {
        if (v.stripe_payment_intent_id) {
          const pi = await stripe.paymentIntents.retrieve(v.stripe_payment_intent_id);
          succeeded = pi.status === "succeeded";
        } else if (v.stripe_session_id) {
          const s = await stripe.checkout.sessions.retrieve(v.stripe_session_id);
          succeeded = s.payment_status === "paid";
        }
      } catch (e: any) {
        results.push({ code: v.code, status: "lookup_failed", error: e.message });
        continue;
      }

      if (!succeeded) {
        results.push({ code: v.code, status: "not_paid" });
        continue;
      }

      await supabase
        .from("mothers_day_vouchers")
        .update({ status: "active" })
        .eq("id", v.id);

      try {
        await supabase.functions.invoke("send-mothers-day-voucher", {
          body: { voucher_id: v.id, triggered_by: "reconcile" },
        });
        results.push({ code: v.code, status: "activated_and_emailed" });
      } catch (e: any) {
        results.push({ code: v.code, status: "activated_email_failed", error: e.message });
      }
    }

    return new Response(JSON.stringify({ success: true, count: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
