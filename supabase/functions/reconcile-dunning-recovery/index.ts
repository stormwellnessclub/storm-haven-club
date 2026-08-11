// Reconcile stale dunning / past-due flags against Stripe.
//
// Problem this solves: `payment_dunning_state` rows are opened when an invoice
// payment fails, but they are only closed inside the stripe-webhook
// `invoice.payment_succeeded` branch. When a payment lands on a Stripe smart
// retry (or the invoice is later voided / marked uncollectible) outside that
// path, the dunning row stays `active` and `members.payment_past_due` stays
// true forever — which hard-blocks the member at check-in even though nothing
// is owed.
//
// This function is the safety net: for every active dunning row it re-reads the
// invoice from Stripe and, when the invoice is no longer collectible
// (paid / void / uncollectible-but-settled), marks the row recovered and
// re-evaluates the member's past-due flag conservatively.
//
// Callers: nightly cron (internal task token) and the admin "Re-check with
// Stripe" button (staff JWT). Accepts optional { memberId } to scope to one
// member, and { dryRun } for inspection.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireTrustedCaller } from "../_shared/requireTrustedCaller.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-task-token, x-internal-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

const log = (step: string, details?: unknown) =>
  console.log(`[RECONCILE-DUNNING] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

/** Invoice states that mean "this invoice is no longer owed". */
const SETTLED_INVOICE_STATUSES = new Set(["paid", "void"]);

interface Outcome {
  member_id: string;
  member_name: string | null;
  stripe_invoice_id: string | null;
  invoice_status: string | null;
  dunning_recovered: boolean;
  past_due_cleared: boolean;
  note?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  // Cron token, service role, or staff JWT (front desk can trigger the
  // per-member re-check from the admin billing view).
  const trusted = await requireTrustedCaller(req, [
    "super_admin",
    "admin",
    "manager",
    "front_desk",
  ]);
  if (!trusted.ok) return trusted.response;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
    apiVersion: "2025-08-27.basil",
  });

  try {
    const body = await req.json().catch(() => ({})) as {
      memberId?: string;
      dryRun?: boolean;
    };
    const dryRun = !!body.dryRun;

    let query = supabase
      .from("payment_dunning_state")
      .select("id, member_id, stripe_invoice_id, status")
      .eq("status", "active");
    if (body.memberId) query = query.eq("member_id", body.memberId);

    const { data: rows, error: rowsErr } = await query;
    if (rowsErr) throw rowsErr;

    const memberIds = [...new Set((rows ?? []).map((r) => r.member_id).filter(Boolean))];
    const nameMap = new Map<string, string>();
    if (memberIds.length > 0) {
      const { data: members } = await supabase
        .from("members")
        .select("id, first_name, last_name")
        .in("id", memberIds);
      for (const m of members ?? []) {
        nameMap.set(m.id, `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim());
      }
    }

    const outcomes: Outcome[] = [];
    const touchedMembers = new Set<string>();
    const nowIso = new Date().toISOString();

    for (const row of rows ?? []) {
      const outcome: Outcome = {
        member_id: row.member_id,
        member_name: nameMap.get(row.member_id) ?? null,
        stripe_invoice_id: row.stripe_invoice_id,
        invoice_status: null,
        dunning_recovered: false,
        past_due_cleared: false,
      };

      if (!row.stripe_invoice_id) {
        outcome.note = "no invoice id on dunning row — left untouched";
        outcomes.push(outcome);
        continue;
      }

      let invoice: Stripe.Invoice | null = null;
      try {
        invoice = await stripe.invoices.retrieve(row.stripe_invoice_id);
      } catch (err) {
        outcome.note = `stripe lookup failed: ${err instanceof Error ? err.message : String(err)}`;
        outcomes.push(outcome);
        continue;
      }

      outcome.invoice_status = invoice?.status ?? null;

      const settled = !!invoice?.status && SETTLED_INVOICE_STATUSES.has(invoice.status);
      if (!settled) {
        outcome.note = "invoice still owed — block kept";
        outcomes.push(outcome);
        continue;
      }

      if (!dryRun) {
        await supabase
          .from("payment_dunning_state")
          .update({ status: "recovered", recovered_at: nowIso, updated_at: nowIso })
          .eq("id", row.id);
      }
      outcome.dunning_recovered = true;
      touchedMembers.add(row.member_id);
      outcomes.push(outcome);
    }

    // Re-evaluate the past-due flag for every member we touched.
    for (const memberId of touchedMembers) {
      const cleared = dryRun
        ? await canClearPastDue(supabase, memberId)
        : await reevaluatePastDue(supabase, memberId, nowIso);
      for (const o of outcomes) {
        if (o.member_id === memberId && o.dunning_recovered) o.past_due_cleared = cleared;
      }
    }

    log("Reconciliation complete", {
      scanned: rows?.length ?? 0,
      recovered: outcomes.filter((o) => o.dunning_recovered).length,
      dryRun,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        dryRun,
        scanned: rows?.length ?? 0,
        recovered: outcomes.filter((o) => o.dunning_recovered).length,
        cleared: outcomes.filter((o) => o.past_due_cleared).length,
        outcomes,
      }),
      { headers: CORS_HEADERS, status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("ERROR", { message });
    return new Response(JSON.stringify({ ok: false, error: message }), {
      headers: CORS_HEADERS,
      status: 500,
    });
  }
});

type Db = ReturnType<typeof createClient>;

/** True when the member has no active dunning rows and no unpaid arrears. */
async function canClearPastDue(supabase: Db, memberId: string): Promise<boolean> {
  const { data: activeDunning } = await supabase
    .from("payment_dunning_state")
    .select("id")
    .eq("member_id", memberId)
    .eq("status", "active")
    .limit(1);
  if (activeDunning && activeDunning.length > 0) return false;

  const { data: unpaidArrears } = await supabase
    .from("billing_arrears")
    .select("id")
    .eq("member_id", memberId)
    .eq("status", "unpaid")
    .limit(1);
  return !unpaidArrears || unpaidArrears.length === 0;
}

/** Clears members.payment_past_due when nothing is owed. Returns whether it cleared. */
export async function reevaluatePastDue(
  supabase: Db,
  memberId: string,
  nowIso = new Date().toISOString(),
): Promise<boolean> {
  const clear = await canClearPastDue(supabase, memberId);
  if (!clear) return false;

  await supabase
    .from("members")
    .update({ payment_past_due: false, payment_past_due_since: null, updated_at: nowIso })
    .eq("id", memberId);
  return true;
}
