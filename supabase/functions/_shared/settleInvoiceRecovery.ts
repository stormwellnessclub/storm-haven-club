// Shared "an invoice just got paid" cleanup.
//
// Marking `billing_arrears` paid is NOT enough to unblock a member: check-in
// reads `members.payment_past_due`, which is only lifted when the matching
// `payment_dunning_state` row is closed. The Stripe `invoice.payment_succeeded`
// webhook normally does that, but manual payments (admin "charge arrears",
// member "retry payment") can settle an invoice without that event arriving —
// which leaves the member hard-blocked after they've paid.
//
// Every code path that pays an invoice off-webhook must call
// `settleInvoiceRecovery` so the recovery row and the past-due flag are closed
// in the same request.

// deno-lint-ignore no-explicit-any
type Db = any;

/** True when the member has no active dunning rows and no unpaid arrears. */
export async function canClearPastDue(supabase: Db, memberId: string): Promise<boolean> {
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
  if (!(await canClearPastDue(supabase, memberId))) return false;

  await supabase
    .from("members")
    .update({ payment_past_due: false, payment_past_due_since: null, updated_at: nowIso })
    .eq("id", memberId);
  return true;
}

export interface SettleResult {
  dunning_recovered: boolean;
  past_due_cleared: boolean;
  attempts_resolved: number;
}

/**
 * Close out everything that hangs off a now-paid invoice:
 *  1. the dunning/recovery row for that invoice → `recovered`
 *  2. any still-`failed` payment attempts for that invoice → resolved
 *  3. the member's past-due flag, but only when nothing else is owed
 *
 * Best-effort: never throws, so a bookkeeping hiccup can't turn a successful
 * charge into an error response for the caller.
 */
export async function settleInvoiceRecovery(
  supabase: Db,
  memberId: string,
  stripeInvoiceId: string,
  resolutionNote = "Invoice paid",
): Promise<SettleResult> {
  const nowIso = new Date().toISOString();
  const result: SettleResult = {
    dunning_recovered: false,
    past_due_cleared: false,
    attempts_resolved: 0,
  };

  try {
    const { data: recovered } = await supabase
      .from("payment_dunning_state")
      .update({ status: "recovered", recovered_at: nowIso, updated_at: nowIso })
      .eq("member_id", memberId)
      .eq("stripe_invoice_id", stripeInvoiceId)
      .eq("status", "active")
      .select("id");
    result.dunning_recovered = !!recovered && recovered.length > 0;

    const { data: attempts } = await supabase
      .from("payment_attempts")
      .update({ resolved_at: nowIso, resolution_note: resolutionNote })
      .eq("member_id", memberId)
      .eq("stripe_invoice_id", stripeInvoiceId)
      .eq("status", "failed")
      .is("resolved_at", null)
      .select("id");
    result.attempts_resolved = attempts?.length ?? 0;

    result.past_due_cleared = await reevaluatePastDue(supabase, memberId, nowIso);
  } catch (err) {
    console.error(
      `[SETTLE-INVOICE-RECOVERY] failed for member ${memberId} / invoice ${stripeInvoiceId}:`,
      err,
    );
  }

  return result;
}
