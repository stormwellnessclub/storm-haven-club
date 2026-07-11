// Reconcile a single payment_attempt / arrears row against Stripe + Application Portal state.
// Returns one of: cancelled | retrying | superseded | disputed | action_needed | resolved | needs_review
// Strict cancellation rule: a row is "cancelled" ONLY when the matching application is cancelled
// AND the linked member is/was pending_activation. Stripe subscription cancellation alone does
// not qualify.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireStaff } from "../_shared/requireStaff.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Classification =
  | "cancelled"
  | "retrying"
  | "superseded"
  | "disputed"
  | "action_needed"
  | "resolved"
  | "needs_review";

interface ReconcileResult {
  attempt_id: string;
  classification: Classification;
  reason_code: string;
  reason_detail: string;
  application_status: string | null;
  member_status: string | null;
  member_was_pending_activation: boolean;
  stripe_subscription_status: string | null;
  next_retry_at: string | null;
  later_successful_charges: Array<{ id: string; created: string; amount: number }>;
  disputed_charges: Array<{ id: string; status: string; amount: number; created: string }>;
  this_charge_disputed: boolean;
  suggested_resolution_reason:
    | "application_cancelled"
    | "superseded_by_later_payment"
    | "stripe_retry_in_progress"
    | "disputed_charge"
    | "written_off_uncollectible"
    | "manual_resolution"
    | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!stripeKey || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ ok: false, error: "missing env" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let body: { attempt_id?: string; attempt_ids?: string[] };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const ids = body.attempt_ids?.length ? body.attempt_ids : (body.attempt_id ? [body.attempt_id] : []);
  if (!ids.length) {
    return new Response(JSON.stringify({ ok: false, error: "attempt_id or attempt_ids required" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const supabase = createClient(supabaseUrl, serviceKey);

  const results: ReconcileResult[] = [];

  for (const id of ids) {
    try {
      results.push(await classifyOne(stripe, supabase, id));
    } catch (e) {
      console.error("[RECONCILE_ARREAR] failed", { id, error: String(e) });
      results.push({
        attempt_id: id,
        classification: "needs_review",
        reason_code: "reconcile_error",
        reason_detail: String(e),
        application_status: null,
        member_status: null,
        member_was_pending_activation: false,
        stripe_subscription_status: null,
        next_retry_at: null,
        later_successful_charges: [],
        disputed_charges: [],
        this_charge_disputed: false,
        suggested_resolution_reason: null,
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});

async function classifyOne(
  stripe: Stripe,
  supabase: ReturnType<typeof createClient>,
  attemptId: string,
): Promise<ReconcileResult> {
  // 1. Fetch the attempt row + linked member
  const { data: attempt, error: aErr } = await supabase
    .from("payment_attempts")
    .select("id, member_id, status, resolved_at, stripe_charge_id, stripe_invoice_id, stripe_payment_intent_id, created_at, next_retry_at")
    .eq("id", attemptId)
    .maybeSingle();
  if (aErr) throw aErr;
  if (!attempt) throw new Error("attempt not found");

  // Already-resolved short circuit
  if (attempt.resolved_at) {
    return baseResult(attemptId, "resolved", "already_resolved", "Row was previously marked resolved", null);
  }

  let member: any = null;
  if (attempt.member_id) {
    const { data: m } = await supabase
      .from("members")
      .select("id, email, status, stripe_subscription_id")
      .eq("id", attempt.member_id)
      .maybeSingle();
    member = m;
  }

  // 2. Look up linked application(s) by email — strict cancellation source
  let applicationStatus: string | null = null;
  let memberWasPendingActivation = false;
  if (member?.email) {
    const { data: apps } = await supabase
      .from("membership_applications")
      .select("status, created_at")
      .ilike("email", member.email)
      .order("created_at", { ascending: false })
      .limit(1);
    applicationStatus = apps?.[0]?.status ?? null;

    // Check the application_status_history for evidence the member was pending_activation
    // when the cancellation happened, OR that current member.status is pending_activation.
    if (member.status === "pending_activation") {
      memberWasPendingActivation = true;
    } else {
      // Look at status history for prior pending_activation
      const { data: hist } = await supabase
        .from("application_status_history")
        .select("old_status, new_status")
        .order("created_at", { ascending: false })
        .limit(20);
      memberWasPendingActivation = !!hist?.some(
        (h) => h.old_status === "pending_activation" || h.new_status === "pending_activation",
      );
    }
  }

  // 3. Apply STRICT cancellation rule first (highest priority)
  const isApplicationCancelled = applicationStatus === "cancelled";
  if (isApplicationCancelled && memberWasPendingActivation) {
    return {
      ...baseResult(attemptId, "cancelled", "application_cancelled", "Application cancelled in Application Portal for a pending_activation member.", attempt.next_retry_at),
      application_status: applicationStatus,
      member_status: member?.status ?? null,
      member_was_pending_activation: true,
      suggested_resolution_reason: "application_cancelled",
    };
  }

  // 4. Pull Stripe context: this charge's dispute, later successful charges, current subscription
  let thisChargeDisputed = false;
  let disputedCharges: ReconcileResult["disputed_charges"] = [];
  let laterSuccessfulCharges: ReconcileResult["later_successful_charges"] = [];
  let stripeSubStatus: string | null = null;
  let stripeNextRetry: string | null = attempt.next_retry_at;

  // Get the customer ID via charge or invoice
  let customerId: string | null = null;
  if (attempt.stripe_charge_id) {
    try {
      const ch = await stripe.charges.retrieve(attempt.stripe_charge_id);
      thisChargeDisputed = !!ch.disputed;
      customerId = (ch.customer as string) ?? null;
    } catch (e) {
      console.warn("charge fetch failed", e);
    }
  }
  if (!customerId && attempt.stripe_invoice_id) {
    try {
      const inv = await stripe.invoices.retrieve(attempt.stripe_invoice_id);
      customerId = (inv.customer as string) ?? null;
      if ((inv as any).next_payment_attempt) {
        stripeNextRetry = new Date((inv as any).next_payment_attempt * 1000).toISOString();
      }
    } catch (e) {
      console.warn("invoice fetch failed", e);
    }
  }

  // Pull the customer's later charges + current subscription
  if (customerId) {
    const attemptTs = Math.floor(new Date(attempt.created_at).getTime() / 1000);
    try {
      const charges = await stripe.charges.list({ customer: customerId, limit: 50 });
      for (const ch of charges.data) {
        if (ch.created <= attemptTs) continue;
        if (ch.status === "succeeded" && !ch.disputed && !ch.refunded) {
          laterSuccessfulCharges.push({
            id: ch.id,
            created: new Date(ch.created * 1000).toISOString(),
            amount: ch.amount / 100,
          });
        }
        if (ch.disputed) {
          disputedCharges.push({
            id: ch.id,
            status: (ch as any).dispute ? "disputed" : "disputed",
            amount: ch.amount / 100,
            created: new Date(ch.created * 1000).toISOString(),
          });
        }
      }
    } catch (e) {
      console.warn("charges list failed", e);
    }

    if (member?.stripe_subscription_id) {
      try {
        const sub = await stripe.subscriptions.retrieve(member.stripe_subscription_id);
        stripeSubStatus = sub.status;
      } catch {
        stripeSubStatus = null;
      }
    }
  }

  // 5. Disputed-aware classification
  if (thisChargeDisputed) {
    return {
      ...baseResult(attemptId, "disputed", "this_charge_disputed", "This charge has an active or settled dispute.", stripeNextRetry),
      application_status: applicationStatus,
      member_status: member?.status ?? null,
      member_was_pending_activation: memberWasPendingActivation,
      stripe_subscription_status: stripeSubStatus,
      this_charge_disputed: true,
      disputed_charges: disputedCharges,
      later_successful_charges: laterSuccessfulCharges,
      suggested_resolution_reason: "disputed_charge",
    };
  }

  // 6. Stripe still retrying?
  if (stripeNextRetry && new Date(stripeNextRetry).getTime() > Date.now()) {
    return {
      ...baseResult(attemptId, "retrying", "stripe_retry_scheduled", `Stripe will retry on ${stripeNextRetry}.`, stripeNextRetry),
      application_status: applicationStatus,
      member_status: member?.status ?? null,
      member_was_pending_activation: memberWasPendingActivation,
      stripe_subscription_status: stripeSubStatus,
      later_successful_charges: laterSuccessfulCharges,
      disputed_charges: disputedCharges,
      suggested_resolution_reason: "stripe_retry_in_progress",
    };
  }

  // 7. Superseded by later non-disputed successful charge
  if (laterSuccessfulCharges.length > 0) {
    return {
      ...baseResult(attemptId, "superseded", "later_payment_succeeded", `Member paid ${laterSuccessfulCharges.length} later non-disputed charge(s) after this attempt.`, stripeNextRetry),
      application_status: applicationStatus,
      member_status: member?.status ?? null,
      member_was_pending_activation: memberWasPendingActivation,
      stripe_subscription_status: stripeSubStatus,
      later_successful_charges: laterSuccessfulCharges,
      disputed_charges: disputedCharges,
      suggested_resolution_reason: "superseded_by_later_payment",
    };
  }

  // 8. Otherwise: action needed
  return {
    ...baseResult(attemptId, "action_needed", "no_recovery_evidence", "Stripe is not retrying and no later successful charge exists. Manual recovery required.", stripeNextRetry),
    application_status: applicationStatus,
    member_status: member?.status ?? null,
    member_was_pending_activation: memberWasPendingActivation,
    stripe_subscription_status: stripeSubStatus,
    later_successful_charges: laterSuccessfulCharges,
    disputed_charges: disputedCharges,
    suggested_resolution_reason: null,
  };
}

function baseResult(
  attempt_id: string,
  classification: Classification,
  reason_code: string,
  reason_detail: string,
  next_retry_at: string | null,
): ReconcileResult {
  return {
    attempt_id,
    classification,
    reason_code,
    reason_detail,
    application_status: null,
    member_status: null,
    member_was_pending_activation: false,
    stripe_subscription_status: null,
    next_retry_at,
    later_successful_charges: [],
    disputed_charges: [],
    this_charge_disputed: false,
    suggested_resolution_reason: null,
  };
}
