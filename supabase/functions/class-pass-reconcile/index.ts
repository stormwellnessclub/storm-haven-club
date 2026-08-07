// Reconciler: finds succeeded Stripe PaymentIntents in the last N days for
// class_pass / kids_care_pass / mothers_day_class_pack purchases that have no
// matching class_passes row, then fulfills them. Idempotent — safe to run
// repeatedly via cron or on-demand from admin UI / post-checkout fallback.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireTrustedCaller } from "../_shared/requireTrustedCaller.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CLASS_PASS_VALIDITY_DAYS = 60;
const KIDS_CARE_VALIDITY_DAYS = 30;
const SINGLE_VALIDITY_DAYS = 7;

type ReconResult = {
  payment_intent_id: string;
  action: string;
  product_kind: string;
  detail?: any;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const _auth = await requireTrustedCaller(req);
  if (!_auth.ok) return _auth.response;

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceKey,
    { auth: { persistSession: false } }
  );


  let body: any = {};
  try { body = await req.json(); } catch (_) { body = {}; }
  const lookbackDays = Math.min(180, Math.max(1, parseInt(body.lookback_days || "14", 10)));
  const singlePi: string | null = body.payment_intent_id || null;

  const results: ReconResult[] = [];

  const log = async (r: ReconResult, extra: Record<string, any> = {}) => {
    results.push(r);
    try {
      await supabase.from("payment_reconciliations").insert({
        stripe_payment_intent_id: r.payment_intent_id,
        product_kind: r.product_kind,
        action: r.action,
        detail: r.detail ?? null,
        ...extra,
      });
    } catch (_) { /* non-fatal */ }
  };

  const fulfillOne = async (pi: Stripe.PaymentIntent) => {
    const md: any = pi.metadata || {};
    const type = md.type || "";

    // Mother's Day pack — delegate to existing idempotent function
    if (type === "mothers_day_class_pack") {
      try {
        const { data, error } = await supabase.functions.invoke("mothers-day-pack-confirm", {
          body: { payment_intent_id: pi.id },
        });
        if (error) throw error;
        await log({
          payment_intent_id: pi.id,
          product_kind: "mothers_day_pack",
          action: (data as any)?.already_fulfilled ? "already_fulfilled" : "fulfilled",
          detail: data,
        }, { amount_cents: pi.amount });
      } catch (e: any) {
        await log({ payment_intent_id: pi.id, product_kind: "mothers_day_pack", action: "error", detail: { message: e?.message } });
      }
      return;
    }

    // Class pass — fulfill inline (mirrors stripe-webhook checkout.session.completed)
    if (type === "class_pass") {
      const userId = md.user_id;
      const category = md.category;
      const passType = md.pass_type;
      const isMember = md.is_member === "true";
      if (!userId || !category || !passType) {
        await log({ payment_intent_id: pi.id, product_kind: "class_pass", action: "skipped", detail: { reason: "missing metadata" } });
        return;
      }
      const mappedCategory =
        category === "pilatesCycling" ? "pilates_cycling" :
        category === "otherClasses" ? "aerobics" : category;
      const classes = passType === "tenPack" ? 10 : 1;
      const validityDays = passType === "tenPack" ? CLASS_PASS_VALIDITY_DAYS : SINGLE_VALIDITY_DAYS;

      let memberId: string | null = null;
      if (isMember) {
        const { data } = await supabase
          .from("members")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle();
        memberId = data?.id ?? null;
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + validityDays);

      const { data: pass, error: insErr } = await supabase
        .from("class_passes")
        .insert({
          user_id: userId,
          member_id: memberId,
          category: mappedCategory,
          pass_type: passType === "tenPack" ? "10-pack" : "single",
          classes_total: classes,
          classes_remaining: classes,
          price_paid: (pi.amount || 0) / 100,
          is_member_price: isMember,
          status: "active",
          expires_at: expiresAt.toISOString(),
          stripe_payment_intent_id: pi.id,
        })
        .select("id")
        .single();

      if (insErr) {
        if ((insErr as any).code === "23505") {
          await log({ payment_intent_id: pi.id, product_kind: "class_pass", action: "already_fulfilled" },
            { user_id: userId, amount_cents: pi.amount });
        } else {
          await log({ payment_intent_id: pi.id, product_kind: "class_pass", action: "error", detail: { message: insErr.message } });
        }
        return;
      }

      await log({ payment_intent_id: pi.id, product_kind: "class_pass", action: "fulfilled", detail: { pass_id: pass?.id } },
        { user_id: userId, amount_cents: pi.amount, class_pass_id: pass?.id });
      return;
    }

    // Kids Care pass
    if (type === "kids_care_pass") {
      const userId = md.user_id;
      const memberId = md.member_id || null;
      if (!userId) {
        await log({ payment_intent_id: pi.id, product_kind: "kids_care_pass", action: "skipped", detail: { reason: "missing user_id" } });
        return;
      }
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + KIDS_CARE_VALIDITY_DAYS);

      const { data: pass, error: insErr } = await supabase
        .from("class_passes")
        .insert({
          user_id: userId,
          member_id: memberId,
          category: "other",
          pass_type: "kids_care",
          classes_total: 16,
          classes_remaining: 16,
          price_paid: (pi.amount || 0) / 100,
          is_member_price: true,
          expires_at: expiresAt.toISOString(),
          status: "active",
          stripe_payment_intent_id: pi.id,
        })
        .select("id")
        .single();

      if (insErr) {
        if ((insErr as any).code === "23505") {
          await log({ payment_intent_id: pi.id, product_kind: "kids_care_pass", action: "already_fulfilled" },
            { user_id: userId, amount_cents: pi.amount });
        } else {
          await log({ payment_intent_id: pi.id, product_kind: "kids_care_pass", action: "error", detail: { message: insErr.message } });
        }
        return;
      }
      await log({ payment_intent_id: pi.id, product_kind: "kids_care_pass", action: "fulfilled", detail: { pass_id: pass?.id } },
        { user_id: userId, amount_cents: pi.amount, class_pass_id: pass?.id });
      return;
    }

    // Not a fulfillable product — ignore silently (do not log every PI)
  };

  try {
    // Single-PI mode
    if (singlePi) {
      const pi = await stripe.paymentIntents.retrieve(singlePi);
      if (pi.status !== "succeeded") {
        return new Response(
          JSON.stringify({ success: false, error: "not_succeeded", status: pi.status }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      // Skip if already mapped
      const { data: existing } = await supabase
        .from("class_passes")
        .select("id")
        .eq("stripe_payment_intent_id", pi.id)
        .maybeSingle();
      if (existing) {
        return new Response(
          JSON.stringify({ success: true, already_fulfilled: true, pass_id: existing.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      await fulfillOne(pi);
      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Bulk scan mode
    const since = Math.floor((Date.now() - lookbackDays * 86400 * 1000) / 1000);
    let starting_after: string | undefined = undefined;
    let scanned = 0;

    // Build the set of PI ids already linked to a class_passes row in lookback window
    const sinceIso = new Date(since * 1000).toISOString();
    const { data: linkedRows } = await supabase
      .from("class_passes")
      .select("stripe_payment_intent_id")
      .not("stripe_payment_intent_id", "is", null)
      .gte("created_at", sinceIso);
    const linked = new Set((linkedRows || []).map((r: any) => r.stripe_payment_intent_id));

    while (true) {
      const page: Stripe.ApiList<Stripe.PaymentIntent> = await stripe.paymentIntents.list({
        limit: 100,
        created: { gte: since },
        ...(starting_after ? { starting_after } : {}),
      });
      for (const pi of page.data) {
        scanned++;
        if (pi.status !== "succeeded") continue;
        const type = (pi.metadata || {}).type || "";
        if (!["class_pass", "kids_care_pass", "mothers_day_class_pack"].includes(type)) continue;
        if (linked.has(pi.id)) continue;
        await fulfillOne(pi);
      }
      if (!page.has_more) break;
      starting_after = page.data[page.data.length - 1]?.id;
      if (!starting_after) break;
    }

    return new Response(
      JSON.stringify({ success: true, scanned, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, error: e?.message || String(e), results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
