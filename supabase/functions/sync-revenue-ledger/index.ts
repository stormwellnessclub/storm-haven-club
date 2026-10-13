// Revenue ledger sync endpoint. The logic lives in _shared/revenueLedgerSync.ts.
//
// POST body (all optional):
//   { "backfill_from": "2025-11-01" }  restart the Stripe cursor at this date
//   { "offline_from": "2025-11-01" }   rebuild offline sales from this date
//   { "stripe": false } / { "offline": false }  skip one half

import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireTrustedCaller } from "../_shared/requireTrustedCaller.ts";
import {
  CURSOR_OVERLAP_SECONDS,
  DEFAULT_START,
  OFFLINE_LOOKBACK_DAYS,
  STATE_KEY,
  STRIPE_API_VERSION,
  TIME_BUDGET_MS,
  syncOffline,
  syncStripe,
  toUnix,
} from "../_shared/revenueLedgerSync.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-task-token, x-internal-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireTrustedCaller(req);
  if (!auth.ok) return auth.response;

  const startedAt = Date.now();
  const deadline = startedAt + TIME_BUDGET_MS;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  let body: Row = {};
  try { body = await req.json(); } catch (_e) { /* empty body = incremental run */ }

  const result: Row = { started_at: new Date(startedAt).toISOString() };
  try {
    const { data: state } = await supabase.from("revenue_ledger_sync_state").select("*").eq("key", STATE_KEY).maybeSingle();

    if (body.stripe !== false) {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
      const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion, httpClient: Stripe.createFetchHttpClient() });
      const start = typeof body.backfill_from === "string"
        ? toUnix(body.backfill_from)
        : state?.cursor_unix
          ? Number(state.cursor_unix) - CURSOR_OVERLAP_SECONDS
          : toUnix(DEFAULT_START);
      result.stripe = await syncStripe(supabase, stripe, start, deadline);
    }

    if (body.offline !== false) {
      const fromIso = typeof body.offline_from === "string"
        ? new Date(`${body.offline_from}T00:00:00-05:00`).toISOString()
        : state?.last_success_at
          ? new Date(Date.now() - OFFLINE_LOOKBACK_DAYS * 86_400_000).toISOString()
          : new Date(`${DEFAULT_START}T00:00:00-05:00`).toISOString();
      result.offline = await syncOffline(supabase, fromIso);
    }

    result.duration_ms = Date.now() - startedAt;
    const caughtUp = body.stripe === false || result.stripe?.caught_up;
    await supabase.from("revenue_ledger_sync_state").upsert({
      key: STATE_KEY,
      last_run_at: new Date().toISOString(),
      ...(caughtUp ? { last_success_at: new Date().toISOString() } : {}),
      last_result: result,
    });
    return json({ success: true, ...result, more_to_sync: !caughtUp });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[sync-revenue-ledger] failed", message);
    await supabase.from("revenue_ledger_sync_state").upsert({
      key: STATE_KEY,
      last_run_at: new Date().toISOString(),
      last_result: { ...result, error: message },
    });
    return json({ success: false, error: message, ...result }, 500);
  }
});
