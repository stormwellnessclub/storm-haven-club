// Backfill historical Stripe charges + invoices into payment_attempts and billing_arrears.
// Idempotent — safe to re-run; dedupes by stripe_charge_id / stripe_invoice_id via the RPC + arrears unique index.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireTrustedCaller } from "../_shared/requireTrustedCaller.ts";
import { getInvoiceSubscriptionId, getLinePriceId } from "../_shared/stripeInvoice.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const log = (s: string, d?: unknown) =>
  console.log(`[BACKFILL-PAYMENTS] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

interface BackfillBody {
  start?: string; // ISO date — default 12 months ago
  end?: string;   // ISO date — default now
  dryRun?: boolean;
  phase?: "charges" | "invoices" | "both"; // default both
}

// Known dues / annual-fee / kids-care price IDs.
// Keep in sync with stripe-webhook PRICE_ID_MAP + product config.
const ANNUAL_FEE_PRICE_IDS = new Set([
  "price_1SlA2BLyZrsSqLhs8VX17F0C",
  "price_1SlA2RLyZrsSqLhsK3XQuANN",
]);
const CLASS_PASS_PRICE_IDS = new Set([
  "price_1SlA2vLyZrsSqLhsBHHWlQPD","price_1T2XzALyZrsSqLhs1N07i160",
  "price_1SlA9sLyZrsSqLhsM0X8VDhN","price_1T2XzfLyZrsSqLhsd8Gu4c7B",
  "price_1T2XmKLyZrsSqLhsmtaMSUiF","price_1SlABFLyZrsSqLhsGOpvWGFE",
  "price_1T2YiALyZrsSqLhsuJGaqAaK","price_1T2XoiLyZrsSqLhsjN7Hb2Lk",
]);
const GUEST_PASS_PRICE_IDS = new Set(["price_1SxATYLyZrsSqLhs6vDu1QWg"]);

function classifyInvoice(inv: Stripe.Invoice): string {
  const lines = inv.lines?.data ?? [];
  for (const line of lines) {
    const priceId = getLinePriceId(line);
    if (!priceId) continue;
    if (ANNUAL_FEE_PRICE_IDS.has(priceId)) return "annual_fee";
    if (CLASS_PASS_PRICE_IDS.has(priceId)) return "class_pass";
    if (GUEST_PASS_PRICE_IDS.has(priceId)) return "guest_pass";
  }
  // Description / product-name heuristics for kids care + shop
  for (const line of lines) {
    const desc = (line.description || "").toLowerCase();
    if (desc.includes("kids care") || desc.includes("kidscare") || desc.includes("kids_care")) return "kids_care";
    if (desc.includes("guest pass")) return "guest_pass";
    if (desc.includes("class pass")) return "class_pass";
    if (desc.includes("shop") || desc.includes("merch")) return "shop";
  }
  // Amount-based fallback for known kids-care subscription price ($75 + processing fee = $77.55)
  if ((inv.amount_due ?? 0) === 7755) return "kids_care";
  // Subscription invoices default to membership dues; otherwise other.
  if (getInvoiceSubscriptionId(inv)) return "membership_dues";
  return "other";
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  // Accepts the service-role key, the anon key (pg_cron nightly rebuild), or an
  // admin/manager JWT. Same pattern as the other scheduled billing functions.
  const authCheck = await requireTrustedCaller(req);
  if (!authCheck.ok) return authCheck.response;

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!stripeKey || !supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required environment variables" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // Authorize: service role, anon (cron), or authenticated admin user.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    let authorized = token === serviceKey || (anonKey && token === anonKey);
    if (!authorized && token) {
      const supaAuth = createClient(supabaseUrl, anonKey ?? serviceKey);
      const { data: userData } = await supaAuth.auth.getUser(token);
      const u = userData?.user;
      if (u) {
        const supaAdmin = createClient(supabaseUrl, serviceKey);
        const { data: roles } = await supaAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", u.id)
          .in("role", ["admin", "super_admin"]);
        authorized = !!(roles && roles.length);
      }
    }
    if (!authorized) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const supabase = createClient(supabaseUrl, serviceKey);


    const body: BackfillBody = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const now = Math.floor(Date.now() / 1000);
    const twelveMonthsAgo = now - 60 * 60 * 24 * 365;
    const startTs = body.start ? Math.floor(new Date(body.start).getTime() / 1000) : twelveMonthsAgo;
    const endTs = body.end ? Math.floor(new Date(body.end).getTime() / 1000) : now;

    // Cap to 24 months
    const maxRange = 60 * 60 * 24 * 365 * 2;
    if (endTs - startTs > maxRange) {
      return new Response(
        JSON.stringify({ ok: false, error: "Date range exceeds 24 months" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    log("Starting backfill", { startTs, endTs, dryRun: !!body.dryRun });

    // Build customer→member map
    const { data: members, error: memberErr } = await supabase
      .from("members")
      .select("id, stripe_customer_id")
      .not("stripe_customer_id", "is", null);
    if (memberErr) throw memberErr;
    const customerToMember = new Map<string, string>();
    for (const m of members || []) {
      if (m.stripe_customer_id) customerToMember.set(m.stripe_customer_id, m.id);
    }
    log("Member map built", { count: customerToMember.size });

    let chargesProcessed = 0;
    let chargesInserted = 0;
    let chargesSkipped = 0;
    let invoicesProcessed = 0;
    let arrearsUpserted = 0;
    const errors: string[] = [];

    const phase = body.phase ?? "both";

    // ── Pass 1: Charges ──
    if (phase === "charges" || phase === "both") {
    let startingAfter: string | undefined;
    let safety = 0;
    while (true) {
      if (++safety > 200) break; // hard cap ~20k charges
      const list = await stripe.charges.list({
        limit: 100,
        created: { gte: startTs, lte: endTs },
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });

      for (const ch of list.data) {
        chargesProcessed++;
        const customerId = typeof ch.customer === "string" ? ch.customer : ch.customer?.id;
        const memberId = customerId ? customerToMember.get(customerId) : null;
        if (!memberId) {
          chargesSkipped++;
          continue;
        }

        const status = ch.status === "succeeded"
          ? "succeeded"
          : ch.refunded
          ? "refunded"
          : ch.status === "failed"
          ? "failed"
          : ch.status;

        const invoiceId = typeof ch.invoice === "string" ? ch.invoice : ch.invoice?.id ?? null;
        const piId = typeof ch.payment_intent === "string"
          ? ch.payment_intent
          : ch.payment_intent?.id ?? null;
        const pmType = ch.payment_method_details?.type ?? null;
        const card = ch.payment_method_details?.card;
        const failureCode = ch.failure_code ?? null;
        const failureMsg = ch.failure_message ?? null;
        const outcome = ch.outcome;
        const declineCode = (outcome as { network_status?: string; reason?: string } | null)?.reason ?? null;

        if (body.dryRun) continue;

        const { error: rpcErr } = await supabase.rpc("log_payment_attempt", {
          p_member_id: memberId,
          p_stripe_invoice_id: invoiceId,
          p_stripe_payment_intent_id: piId,
          p_stripe_charge_id: ch.id,
          p_stripe_subscription_id: null,
          p_invoice_number: null,
          p_amount: ch.amount / 100,
          p_currency: ch.currency || "usd",
          p_status: status,
          p_attempt_number: 1,
          p_payment_method_id: typeof ch.payment_method === "string" ? ch.payment_method : null,
          p_payment_method_type: pmType,
          p_failure_code: failureCode,
          p_failure_message: failureMsg,
          p_decline_code: declineCode,
          p_decline_reason: outcome?.seller_message ?? null,
          p_retry_attempted: false,
          p_next_retry_at: null,
          p_succeeded_at: status === "succeeded" ? new Date(ch.created * 1000).toISOString() : null,
          p_failed_at: status === "failed" ? new Date(ch.created * 1000).toISOString() : null,
          p_metadata: {
            backfilled: true,
            card_brand: card?.brand ?? null,
            card_last4: card?.last4 ?? null,
            description: ch.description ?? null,
            stripe_created: ch.created,
          },
        });

        if (rpcErr) {
          errors.push(`charge ${ch.id}: ${rpcErr.message}`);
        } else {
          chargesInserted++;
        }
      }

      if (!list.has_more) break;
      startingAfter = list.data[list.data.length - 1]?.id;
      if (!startingAfter) break;
    }

    log("Charges pass complete", { chargesProcessed, chargesInserted, chargesSkipped });
    } // end charges phase

    // ── Pass 2: Invoices (for arrears/unpaid tracking) ──
    if (phase === "invoices" || phase === "both") {
    let invStartingAfter: string | undefined;
    let safety = 0;
    while (true) {
      if (++safety > 200) break;
      const list = await stripe.invoices.list({
        limit: 100,
        created: { gte: startTs, lte: endTs },
        ...(invStartingAfter ? { starting_after: invStartingAfter } : {}),
      });

      for (const inv of list.data) {
        invoicesProcessed++;
        const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
        const memberId = customerId ? customerToMember.get(customerId) : null;
        if (!memberId || !inv.id) continue;

        const isUnpaid = inv.status === "open" || inv.status === "uncollectible" || inv.status === "past_due";
        const isPaid = inv.status === "paid";
        if (!isUnpaid && !isPaid) continue; // skip drafts / voided

        const periodStart = inv.period_start
          ? new Date(inv.period_start * 1000).toISOString().split("T")[0]
          : new Date(inv.created * 1000).toISOString().split("T")[0];
        const periodEnd = inv.period_end
          ? new Date(inv.period_end * 1000).toISOString().split("T")[0]
          : periodStart;

        if (body.dryRun) continue;

        const billingType = classifyInvoice(inv);

        const { error: arrErr } = await supabase
          .from("billing_arrears")
          .upsert(
            {
              member_id: memberId,
              stripe_invoice_id: inv.id,
              billing_type: billingType,
              period_start: periodStart,
              period_end: periodEnd,
              amount_due_cents: inv.amount_due ?? 0,
              amount_paid_cents: inv.amount_paid ?? 0,
              currency: inv.currency || "usd",
              stripe_subscription_id: getInvoiceSubscriptionId(inv),
              status: isPaid ? "paid" : "unpaid",
              attempt_count: inv.attempt_count ?? 0,
              paid_at: isPaid && inv.status_transitions?.paid_at
                ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
                : null,
              next_retry_at: inv.next_payment_attempt
                ? new Date(inv.next_payment_attempt * 1000).toISOString()
                : null,
            },
            { onConflict: "member_id,stripe_invoice_id" },
          );
        if (arrErr) {
          errors.push(`invoice ${inv.id}: ${arrErr.message}`);
        } else {
          arrearsUpserted++;
        }
      }

      if (!list.has_more) break;
      invStartingAfter = list.data[list.data.length - 1]?.id;
      if (!invStartingAfter) break;
    }

    log("Invoices pass complete", { invoicesProcessed, arrearsUpserted });
    } // end invoices phase

    return new Response(
      JSON.stringify({
        ok: true,
        dryRun: !!body.dryRun,
        window: {
          start: new Date(startTs * 1000).toISOString(),
          end: new Date(endTs * 1000).toISOString(),
        },
        charges: {
          processed: chargesProcessed,
          inserted: chargesInserted,
          skippedNoMember: chargesSkipped,
        },
        invoices: {
          processed: invoicesProcessed,
          arrearsUpserted,
        },
        errors: errors.slice(0, 25),
        errorCount: errors.length,
      }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[BACKFILL-PAYMENTS] FATAL", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
});
