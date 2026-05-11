// Admin-only: scan Stripe for Mother's Day Class Pack PaymentIntents that never
// completed and upsert them into pending_class_pass_checkouts so the admin
// "Abandoned Class Pass Checkouts" page can show them and send reminders.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (...a: unknown[]) => console.log("[backfill-md-abandoned]", ...a);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    if (!stripeKey.startsWith("sk_")) {
      return new Response(JSON.stringify({ success: false, error: "Stripe key missing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Admin gate
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const anon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data: userData } = await anon.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const allowed = new Set(["super_admin", "admin", "manager"]);
    const isAllowed = (roles ?? []).some((r: any) => allowed.has(r.role));
    if (!isAllowed) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Search Stripe for unfinished Mother's Day pack PaymentIntents in the last 14 days
    const cutoff = Math.floor((Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000);
    const query = `metadata['type']:'mothers_day_class_pack' AND status:'requires_payment_method' AND created>${cutoff}`;
    log("searching", query);
    const search = await stripe.paymentIntents.search({ query, limit: 100 });
    log("found", search.data.length);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const pi of search.data) {
      const md = pi.metadata || {};
      const email = (md.buyer_email || "").toString().trim().toLowerCase();
      if (!email) {
        skipped++;
        continue;
      }

      // Skip if buyer has any later succeeded MD pack intent (already recovered)
      try {
        const successQ = await stripe.paymentIntents.search({
          query: `metadata['type']:'mothers_day_class_pack' AND status:'succeeded' AND metadata['buyer_email']:'${email}'`,
          limit: 1,
        });
        const succeededLater = successQ.data.some((s) => s.created >= pi.created);
        if (succeededLater) {
          // Mark any existing pending row recovered
          await supabase
            .from("pending_class_pass_checkouts")
            .update({ status: "recovered" })
            .eq("stripe_payment_intent_id", pi.id);
          skipped++;
          continue;
        }
      } catch (e) {
        log("recovery check failed", (e as Error).message);
      }

      const tier = md.tier === "member" ? true : false;
      const isGift = md.is_gift === "true";

      // Check if row already exists
      const { data: existing } = await supabase
        .from("pending_class_pass_checkouts")
        .select("id, status")
        .eq("stripe_payment_intent_id", pi.id)
        .maybeSingle();

      const row = {
        user_id: md.buyer_user_id || null,
        email,
        name: md.buyer_name || null,
        stripe_payment_intent_id: pi.id,
        product_kind: "mothers_day_pack",
        is_member: tier,
        is_gift: isGift,
        gift_recipient_email: md.recipient_email || null,
        gift_recipient_name: md.recipient_name || null,
        amount_cents: pi.amount,
        status: "pending" as const,
      };

      if (existing) {
        const { error } = await supabase
          .from("pending_class_pass_checkouts")
          .update(row)
          .eq("id", existing.id);
        if (error) errors.push(`update ${pi.id}: ${error.message}`);
        else updated++;
      } else {
        const { error } = await supabase
          .from("pending_class_pass_checkouts")
          .insert(row);
        if (error) errors.push(`insert ${pi.id}: ${error.message}`);
        else inserted++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        found: search.data.length,
        inserted,
        updated,
        skipped,
        errors: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e: any) {
    console.error("[backfill-md-abandoned] error", e?.message || e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message || "Internal error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
