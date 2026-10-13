// Billing reconciliation endpoint: compares the app's billing records with Stripe
// and repairs drift. Logic and safety rules live in _shared/billingReconciliation.ts.
//
// Called nightly by the reconcile-billing-nightly cron job and on demand by staff
// ("Run now" on the Billing Arrears page). Never charges, refunds or emails.
//
// POST body (optional): { "trigger": "scheduled" | "manual" }

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
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    const stripe = new Stripe(stripeKey, {
      apiVersion: RECONCILE_STRIPE_API_VERSION as Stripe.LatestApiVersion,
      httpClient: Stripe.createFetchHttpClient(),
    });

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
