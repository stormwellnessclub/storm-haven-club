// One-shot backfill: fetch disputes from Stripe (last 12 months) and update payment_attempts + billing_arrears.
// Idempotent — safe to re-run. Admin-only.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const log = (msg: string, details?: unknown) => {
  console.log(`[BACKFILL-DISPUTES] ${msg}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS, status: 204 });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!stripeKey || !supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing configuration" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Verify caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isAdmin = (roles ?? []).some((r) =>
      ["super_admin", "admin", "manager"].includes(r.role as string),
    );
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion });

    // 12 months ago (epoch seconds)
    const since = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 365;
    log("Backfill starting", { since });

    let updated = 0;
    let unmatched = 0;
    let arrearsReopened = 0;
    let lastId: string | undefined;

    // Paginate through all disputes
    while (true) {
      const page: Stripe.ApiList<Stripe.Dispute> = await stripe.disputes.list({
        limit: 100,
        created: { gte: since },
        ...(lastId ? { starting_after: lastId } : {}),
      });

      for (const dispute of page.data) {
        const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
        if (!chargeId) continue;

        const { data: attempt } = await supabase
          .from("payment_attempts")
          .select("id, member_id, stripe_invoice_id, stripe_subscription_id")
          .eq("stripe_charge_id", chargeId)
          .maybeSingle();

        if (!attempt) {
          unmatched++;
          continue;
        }

        const status = dispute.status;
        const isWon = status === "won";
        const lostOrRefunded = status === "lost" || status === "charge_refunded";

        const { error: updErr } = await supabase
          .from("payment_attempts")
          .update({
            dispute_id: dispute.id,
            dispute_status: status,
            dispute_reason: dispute.reason,
            disputed_at: isWon ? null : new Date(dispute.created * 1000).toISOString(),
          })
          .eq("id", attempt.id);
        if (updErr) {
          log("Update error", { attemptId: attempt.id, err: updErr.message });
          continue;
        }
        updated++;

        // Reopen arrears for membership-related, non-won disputes
        if (
          attempt.stripe_invoice_id &&
          attempt.member_id &&
          (status === "needs_response" ||
            status === "under_review" ||
            status === "warning_needs_response" ||
            status === "warning_under_review" ||
            lostOrRefunded)
        ) {
          const { error: aErr } = await supabase
            .from("billing_arrears")
            .update({
              status: "unpaid",
              paid_at: null,
              reopened_reason: "disputed_charge",
              reopened_at: new Date().toISOString(),
              failure_message: `Disputed (${dispute.reason}) — status: ${status}`,
            })
            .eq("member_id", attempt.member_id)
            .eq("stripe_invoice_id", attempt.stripe_invoice_id);
          if (!aErr) arrearsReopened++;
        }
      }

      if (!page.has_more) break;
      lastId = page.data[page.data.length - 1]?.id;
      if (!lastId) break;
    }

    log("Backfill complete", { updated, unmatched, arrearsReopened });

    return new Response(
      JSON.stringify({ ok: true, updated, unmatched, arrearsReopened }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
