import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireStaff } from "../_shared/requireStaff.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const log = (step: string, details?: unknown) =>
  console.log(`[SYNC-MEMBERSHIP-TRUTH] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

const ts = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null);

const TERMINAL = ["canceled", "cancelled", "incomplete_expired"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS, status: 204 });
  }

  // Scheduled runs authenticate with a shared cron secret; interactive runs
  // must present a super-admin JWT.
  const cronSecret = Deno.env.get("MEMBERSHIP_SYNC_CRON_SECRET");
  const isCron = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;
  if (!isCron) {
    const authCheck = await requireStaff(req, ["super_admin"]);
    if (!authCheck.ok) return authCheck.response;
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      status,
    });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!stripeKey || !supabaseUrl || !serviceKey) {
      return json({ error: "Missing environment configuration" }, 500);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    let body: { memberId?: string; limit?: number } = {};
    try {
      body = await req.json();
    } catch {
      /* no body */
    }

    let query = supabase
      .from("members")
      .select(
        "id, first_name, last_name, email, status, subscription_status, stripe_customer_id, stripe_subscription_id, membership_type, is_founding_member",
      );

    if (body.memberId) {
      query = query.eq("id", body.memberId);
    } else {
      query = query.in("status", ["active", "frozen", "pending_activation"]);
    }

    const { data: members, error: membersError } = await query;
    if (membersError) throw membersError;

    log("Members to sync", { count: members?.length ?? 0 });

    const snapshots: Record<string, unknown>[] = [];
    const statusFixes: { id: string; subscription_status: string }[] = [];
    let errors = 0;

    for (const m of members ?? []) {
      const anomalies: string[] = [];
      const snap: Record<string, unknown> = {
        member_id: m.id,
        stripe_customer_id: m.stripe_customer_id,
        collection_paused: false,
        cancel_at_period_end: false,
        anomalies,
        sync_error: null,
        synced_at: new Date().toISOString(),
      };

      if (!m.stripe_customer_id) {
        if (m.status === "active" && !m.is_founding_member && m.subscription_status !== "sponsored") {
          anomalies.push("No Stripe customer");
        }
        snap.effective_status = m.subscription_status ?? "none";
        snapshots.push(snap);
        continue;
      }

      try {
        const subs = await stripe.subscriptions.list({
          customer: m.stripe_customer_id,
          status: "all",
          limit: 20,
          expand: ["data.default_payment_method"],
        });

        const live = subs.data.filter((s) => !TERMINAL.includes(s.status));
        // Heuristic: the recurring monthly subscription is the dues sub; a
        // yearly-interval subscription is the annual membership fee.
        const isAnnual = (s: Stripe.Subscription) =>
          s.items.data.some((i) => i.price?.recurring?.interval === "year");

        const dues = live.find((s) => !isAnnual(s)) ?? subs.data.find((s) => !isAnnual(s)) ?? null;
        const annual = live.find(isAnnual) ?? subs.data.find(isAnnual) ?? null;

        snap.dues_subscription_id = dues?.id ?? null;
        snap.dues_status = dues?.status ?? null;
        snap.annual_subscription_id = annual?.id ?? null;
        snap.annual_status = annual?.status ?? null;

        if (dues) {
          const paused = !!dues.pause_collection;
          snap.collection_paused = paused;
          snap.resumes_at = ts(dues.pause_collection?.resumes_at ?? null);
          snap.next_billing_at = ts((dues as unknown as { current_period_end?: number }).current_period_end ?? null);
          snap.cancel_at_period_end = !!dues.cancel_at_period_end;
          snap.canceled_at = ts(dues.canceled_at);

          const pm = dues.default_payment_method as Stripe.PaymentMethod | null;
          if (pm && typeof pm !== "string" && pm.card) {
            snap.card_brand = pm.card.brand;
            snap.card_last4 = pm.card.last4;
            snap.card_exp_month = pm.card.exp_month;
            snap.card_exp_year = pm.card.exp_year;
          }

          if (paused && !dues.pause_collection?.resumes_at) anomalies.push("Paused with no resume date");
        }

        // Default card from the customer when the sub doesn't carry one.
        if (!snap.card_last4) {
          const customer = await stripe.customers.retrieve(m.stripe_customer_id, {
            expand: ["invoice_settings.default_payment_method"],
          });
          if (customer && !("deleted" in customer && customer.deleted)) {
            const pm = (customer as Stripe.Customer).invoice_settings
              ?.default_payment_method as Stripe.PaymentMethod | null;
            if (pm && typeof pm !== "string" && pm.card) {
              snap.card_brand = pm.card.brand;
              snap.card_last4 = pm.card.last4;
              snap.card_exp_month = pm.card.exp_month;
              snap.card_exp_year = pm.card.exp_year;
            }
          }
        }

        // Invoices are the real payment record — not the local tables.
        const invoices = await stripe.invoices.list({ customer: m.stripe_customer_id, limit: 24 });
        const paid = invoices.data.find((i) => i.status === "paid" && (i.amount_paid ?? 0) > 0);
        const failed = invoices.data.find(
          (i) => i.status === "open" || i.status === "uncollectible",
        );

        snap.last_paid_at = ts(paid?.status_transitions?.paid_at ?? paid?.created ?? null);
        snap.last_paid_amount_cents = paid?.amount_paid ?? null;
        snap.last_failed_at = failed ? ts(failed.created) : null;
        snap.last_failed_amount_cents = failed?.amount_due ?? null;
        snap.amount_due_cents = live.reduce(
          (sum, s) => sum + (s.status === "past_due" || s.status === "unpaid" ? 0 : 0),
          failed?.amount_remaining ?? 0,
        );

        // Effective status from Stripe, dues subscription wins.
        const effective = snap.collection_paused
          ? "paused"
          : (dues?.status ?? (m.subscription_status === "sponsored" ? "sponsored" : "none"));
        snap.effective_status = effective;

        // Anomaly detection
        if (m.status === "active" && !dues && !m.is_founding_member && m.subscription_status !== "sponsored") {
          anomalies.push("Active member with no dues subscription in Stripe");
        }
        if (dues?.status === "active" && snap.last_paid_at) {
          const days = (Date.now() - new Date(snap.last_paid_at as string).getTime()) / 86400000;
          if (days > 45) anomalies.push(`No paid invoice in ${Math.floor(days)} days`);
        }
        if (dues?.status === "active" && !snap.last_paid_at) {
          anomalies.push("Subscription active but no paid invoice on record");
        }
        if (snap.card_exp_year && snap.card_exp_month) {
          const exp = new Date(Number(snap.card_exp_year), Number(snap.card_exp_month), 0);
          if (exp.getTime() < Date.now()) anomalies.push("Card expired");
          else if (exp.getTime() < Date.now() + 45 * 86400000) anomalies.push("Card expiring soon");
        }
        if (!snap.card_last4 && m.status === "active" && m.subscription_status !== "sponsored") {
          anomalies.push("No card on file");
        }

        // Correct the drifting local column when Stripe disagrees.
        const localStatus = m.subscription_status ?? "none";
        const stripeStatus =
          snap.collection_paused ? localStatus : (dues?.status ?? null);
        if (
          stripeStatus &&
          stripeStatus !== localStatus &&
          m.subscription_status !== "sponsored"
        ) {
          statusFixes.push({ id: m.id, subscription_status: stripeStatus });
        }
      } catch (e) {
        errors++;
        snap.sync_error = e instanceof Error ? e.message : String(e);
        log("Member sync failed", { memberId: m.id, error: snap.sync_error });
      }

      snap.anomalies = anomalies;
      snapshots.push(snap);
    }

    // Upsert in chunks
    for (let i = 0; i < snapshots.length; i += 100) {
      const chunk = snapshots.slice(i, i + 100);
      const { error } = await supabase
        .from("member_billing_snapshot")
        .upsert(chunk, { onConflict: "member_id" });
      if (error) throw error;
    }

    for (const fix of statusFixes) {
      await supabase
        .from("members")
        .update({ subscription_status: fix.subscription_status })
        .eq("id", fix.id);
    }

    log("Sync complete", { synced: snapshots.length, fixed: statusFixes.length, errors });

    return json({
      success: true,
      synced: snapshots.length,
      status_corrections: statusFixes.length,
      errors,
      synced_at: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("FATAL", { msg });
    return json({ error: msg }, 500);
  }
});
