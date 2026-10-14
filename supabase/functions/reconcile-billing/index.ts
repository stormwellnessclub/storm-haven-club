// Billing reconciliation endpoint: compares the app's billing records with Stripe
// and repairs drift. Logic and safety rules live in _shared/billingReconciliation.ts.
//
// Called nightly by the reconcile-billing-nightly cron job and on demand by staff
// ("Run now" on the Billing Arrears page). Never charges, refunds or emails.
//
// POST body (optional):
//   { "trigger": "scheduled" | "manual" }       full comparison (default)
// Staff-only actions:
//   { "action": "apply_payment", "charge_id", "invoice_id", "item_id"? }
//       apply a standalone Stripe charge to an open dues bill (from a review item)
//   { "action": "fix_bill_dates", "after_id"? }
//       correct stored bill dates from Stripe; returns next_after_id to continue

import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireTrustedCaller } from "../_shared/requireTrustedCaller.ts";
import { RECONCILE_STRIPE_API_VERSION, Reconciler } from "../_shared/billingReconciliation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-task-token, x-internal-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const TIME_BUDGET_MS = 110_000;
const STALE_RUN_MS = 15 * 60 * 1000;

function stripeClient(): Stripe {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(stripeKey, {
    apiVersion: RECONCILE_STRIPE_API_VERSION as Stripe.LatestApiVersion,
    httpClient: Stripe.createFetchHttpClient(),
  });
}

// deno-lint-ignore no-explicit-any
async function staffAction(supabase: any, body: Record<string, unknown>, userId: string, startedAt: number): Promise<Response> {
  const stripe = stripeClient();
  const { data: run, error: runErr } = await supabase
    .from("billing_reconciliation_runs")
    .insert({ trigger: "manual", triggered_by: userId, summary: { action: body.action } })
    .select("id")
    .single();
  if (runErr || !run) return json({ success: false, error: runErr?.message ?? "Could not start" }, 500);
  const reconciler = new Reconciler({ supabase, stripe, runId: run.id, deadline: startedAt + TIME_BUDGET_MS });
  const finish = async (status: "succeeded" | "failed", summary: Record<string, unknown>, error?: string) => {
    await supabase.from("billing_reconciliation_runs")
      .update({ status, finished_at: new Date().toISOString(), summary: { action: body.action, ...summary }, error: error ?? null })
      .eq("id", run.id);
  };

  try {
    if (body.action === "fix_bill_dates") {
      const result = await reconciler.fixBillDates(typeof body.after_id === "string" ? body.after_id : null);
      await finish("succeeded", { ...result, corrected: result.fixed, needs_review: 0, complete: result.next_after_id === null });
      return json({ success: true, ...result, more: result.next_after_id !== null });
    }

    // apply_payment
    const chargeId = String(body.charge_id ?? "");
    const invoiceId = String(body.invoice_id ?? "");
    if (!chargeId || !invoiceId) throw new Error("charge_id and invoice_id are required");
    // deno-lint-ignore no-explicit-any
    const charge = await stripe.charges.retrieve(chargeId) as any;
    // deno-lint-ignore no-explicit-any
    const invoice = await stripe.invoices.retrieve(invoiceId) as any;
    const chargeCustomer = typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
    const invoiceCustomer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    if (charge.status !== "succeeded" || charge.refunded) throw new Error("That payment did not succeed or was refunded.");
    if (charge.invoice) throw new Error("That payment already belongs to a bill.");
    if (charge.metadata?.applied_to_invoice) throw new Error(`That payment was already applied to bill ${charge.metadata.applied_to_invoice}.`);
    if (invoice.status !== "open") throw new Error(`That bill is ${invoice.status}, not open.`);
    if (!chargeCustomer || chargeCustomer !== invoiceCustomer) throw new Error("The payment and the bill belong to different customers.");
    const { data: member } = await supabase
      .from("members").select("id").eq("stripe_customer_id", invoiceCustomer).limit(1).maybeSingle();
    if (!member) throw new Error("No member record for this Stripe customer.");

    const { period, recovery, reactivated } = await reconciler.applyStandalonePayment({
      charge, invoice, memberId: member.id, appliedBy: userId,
    });
    await supabase.from("billing_reconciliation_items").insert({
      run_id: run.id, member_id: member.id, stripe_invoice_id: invoice.id,
      kind: "applied_standalone_payment", action: "corrected",
      message: `Staff applied the separate ${"$" + (charge.amount / 100).toFixed(2)} payment of ${new Date(charge.created * 1000).toISOString().slice(0, 10)} to the ${period.start} – ${period.end} bill (marked paid outside Stripe).`,
      after_state: { invoice_status: "paid", reminders_stopped: recovery.dunning_recovered, past_due_cleared: recovery.past_due_cleared, member_status: reactivated },
      details: { charge_id: charge.id, invoice_id: invoice.id },
    });
    if (typeof body.item_id === "string" && body.item_id) {
      await supabase.from("billing_reconciliation_items")
        .update({ reviewed_at: new Date().toISOString(), reviewed_by: userId, review_note: "Applied to bill" })
        .eq("id", body.item_id).eq("action", "needs_review");
    }
    await finish("succeeded", { corrected: 1, needs_review: 0, complete: true });
    return json({ success: true, invoice_id: invoice.id, past_due_cleared: recovery.past_due_cleared });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await finish("failed", {}, message);
    return json({ success: false, error: message }, 200);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireTrustedCaller(req);
  if (!auth.ok) return auth.response;

  const startedAt = Date.now();
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_e) { /* empty body */ }
  const trigger = body.trigger === "scheduled" || auth.kind !== "staff" ? "scheduled" : "manual";

  if (body.action === "apply_payment" || body.action === "fix_bill_dates") {
    if (auth.kind !== "staff") return json({ success: false, error: "Staff only" }, 403);
    return await staffAction(supabase, body, auth.userId as string, startedAt);
  }

  // One run at a time; a run older than 15 minutes is treated as dead.
  const { data: running } = await supabase
    .from("billing_reconciliation_runs")
    .select("id, started_at")
    .eq("status", "running")
    .gte("started_at", new Date(Date.now() - STALE_RUN_MS).toISOString())
    .limit(1);
  if (running && running.length > 0) {
    return json({ success: false, error: "A reconciliation is already running. Try again in a few minutes.", run_id: running[0].id }, 409);
  }
  await supabase
    .from("billing_reconciliation_runs")
    .update({ status: "failed", finished_at: new Date().toISOString(), error: "Run did not finish (timed out or crashed)" })
    .eq("status", "running");

  const { data: run, error: runErr } = await supabase
    .from("billing_reconciliation_runs")
    .insert({ trigger, triggered_by: auth.kind === "staff" ? auth.userId : null })
    .select("id")
    .single();
  if (runErr || !run) return json({ success: false, error: runErr?.message ?? "Could not start run" }, 500);

  try {
    const stripe = stripeClient();

    const reconciler = new Reconciler({ supabase, stripe, runId: run.id, deadline: startedAt + TIME_BUDGET_MS });
    const summary = await reconciler.run();

    await supabase
      .from("billing_reconciliation_runs")
      .update({ status: "succeeded", finished_at: new Date().toISOString(), summary: { ...summary, duration_ms: Date.now() - startedAt } })
      .eq("id", run.id);
    return json({ success: true, run_id: run.id, ...summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[reconcile-billing] failed", message);
    await supabase
      .from("billing_reconciliation_runs")
      .update({ status: "failed", finished_at: new Date().toISOString(), error: message })
      .eq("id", run.id);
    return json({ success: false, run_id: run.id, error: message }, 500);
  }
});
