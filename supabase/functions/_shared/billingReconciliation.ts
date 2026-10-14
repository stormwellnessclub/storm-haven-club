// Billing reconciliation: compare the app's billing records with Stripe.
//
// Stripe decides whether an invoice is paid; the app finds out through webhooks.
// When a webhook is lost or fails, the app drifts: a month Stripe collected still
// shows as owed (member flagged past due, reminder emails continue), or a payment
// never reaches payment history. This module finds and repairs that drift.
//
// Rule: corrections are applied automatically only when they RELEASE a member
// (a month is paid, reminders stop, the past-due flag clears). Anything that would
// RESTRICT a member — Stripe says a month is unpaid but the app has no record of
// it — is recorded for staff review instead. Nothing here charges, refunds or
// emails anyone.
//
// Every finding is written to billing_reconciliation_items for the audit trail.

import Stripe from "https://esm.sh/stripe@18.5.0";
import { reevaluatePastDue, settleInvoiceRecovery } from "./settleInvoiceRecovery.ts";
import { invoiceServicePeriod } from "./invoicePeriod.ts";

// deno-lint-ignore no-explicit-any
type Db = any;
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

/** API version that still exposes invoice.subscription, invoice.payment_intent and line.price. */
export const RECONCILE_STRIPE_API_VERSION = "2023-10-16";
export const MISSED_PAYMENT_LOOKBACK_DAYS = 35;
export const UNTRACKED_OPEN_LOOKBACK_DAYS = 120;
export const STANDALONE_PAYMENT_LOOKBACK_DAYS = 60;
export const STALE_FAILURE_BATCH = 200;

/** A standalone (non-invoice) charge whose description says it pays dues. */
export const DUES_CHARGE_RE = /\b(dues|past due|membership|failed payment recovery|monthly)\b/i;

const ANNUAL_FEE_PRICE_IDS = new Set(["price_1SlA2BLyZrsSqLhs8VX17F0C", "price_1SlA2RLyZrsSqLhsK3XQuANN"]);
const OPEN_ARREARS_STATUSES = ["unpaid", "partial", "processing"];

export type FindingAction = "corrected" | "needs_review" | "info";

export interface Finding {
  kind: string;
  action: FindingAction;
  message: string;
  member_id?: string | null;
  stripe_invoice_id?: string | null;
  before_state?: Row | null;
  after_state?: Row | null;
  details?: Row;
}

export interface ReconcileContext {
  supabase: Db;
  stripe: Stripe;
  runId: string;
  deadline: number;
  log?: (msg: string, data?: Row) => void;
}

export interface ReconcileSummary {
  invoices_checked: number;
  corrected: number;
  needs_review: number;
  info: number;
  by_kind: Record<string, number>;
  complete: boolean;
  phases: Record<string, "done" | "skipped_time_limit">;
}

const nowIso = () => new Date().toISOString();
const unixToIso = (u: number | null | undefined) => (u ? new Date(u * 1000).toISOString() : null);
const unixToDate = (u: number | null | undefined) => (u ? new Date(u * 1000).toISOString().slice(0, 10) : null);
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function subscriptionIdOf(inv: Row): string | null {
  const s = inv.subscription ?? inv.parent?.subscription_details?.subscription ?? null;
  return typeof s === "string" ? s : s?.id ?? null;
}
function customerIdOf(inv: Row): string | null {
  return typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null;
}
function paymentIntentIdOf(inv: Row): string | null {
  return typeof inv.payment_intent === "string" ? inv.payment_intent : inv.payment_intent?.id ?? null;
}
function chargeIdOf(inv: Row): string | null {
  return typeof inv.charge === "string" ? inv.charge : inv.charge?.id ?? null;
}
function isPtPlan(inv: Row): boolean {
  return inv.subscription_details?.metadata?.type === "pt_payment_plan";
}
function isAnnualFee(inv: Row): boolean {
  return (inv.lines?.data ?? []).some((l: Row) => l.price?.id && ANNUAL_FEE_PRICE_IDS.has(l.price.id));
}

export class Reconciler {
  private findings: Finding[] = [];
  private invoiceCache = new Map<string, Row | null>();
  private memberCache = new Map<string, Row | null>();
  invoicesChecked = 0;

  constructor(private ctx: ReconcileContext) {}

  private log(msg: string, data?: Row) {
    (this.ctx.log ?? ((m: string, d?: Row) => console.log(`[reconcile-billing] ${m}`, d ?? "")))(msg, data);
  }

  private outOfTime() {
    return Date.now() > this.ctx.deadline;
  }

  private async record(f: Finding) {
    this.findings.push(f);
    const { error } = await this.ctx.supabase.from("billing_reconciliation_items").insert({
      run_id: this.ctx.runId,
      member_id: f.member_id ?? null,
      stripe_invoice_id: f.stripe_invoice_id ?? null,
      kind: f.kind,
      action: f.action,
      message: f.message,
      before_state: f.before_state ?? null,
      after_state: f.after_state ?? null,
      details: f.details ?? {},
    });
    // 23505: the same problem is already open for review from an earlier run.
    if (error && error.code !== "23505") this.log("could not record finding", { error: error.message, kind: f.kind });
  }

  private async getInvoice(id: string): Promise<Row | null> {
    if (this.invoiceCache.has(id)) return this.invoiceCache.get(id)!;
    try {
      const inv = await this.ctx.stripe.invoices.retrieve(id) as unknown as Row;
      this.invoiceCache.set(id, inv);
      this.invoicesChecked++;
      return inv;
    } catch (e) {
      const err = e as { code?: string; statusCode?: number; message?: string };
      if (err?.code === "resource_missing" || err?.statusCode === 404) {
        this.invoiceCache.set(id, null);
        return null;
      }
      throw e;
    }
  }

  /** Same member lookup the Stripe webhook uses: subscription first, then customer. */
  private async memberForInvoice(inv: Row): Promise<Row | null> {
    const key = `${subscriptionIdOf(inv)}|${customerIdOf(inv)}`;
    if (this.memberCache.has(key)) return this.memberCache.get(key)!;
    const cols = "id, status, payment_past_due, first_name, last_name, stripe_subscription_id, annual_fee_subscription_id, stripe_customer_id";
    let member: Row | null = null;
    const subId = subscriptionIdOf(inv);
    if (subId) {
      for (const col of ["stripe_subscription_id", "annual_fee_subscription_id"]) {
        const { data } = await this.ctx.supabase.from("members").select(cols).eq(col, subId).limit(1).maybeSingle();
        if (data) { member = data; break; }
      }
    }
    const custId = customerIdOf(inv);
    if (!member && custId) {
      const { data } = await this.ctx.supabase.from("members").select(cols).eq("stripe_customer_id", custId).limit(1).maybeSingle();
      member = data ?? null;
    }
    this.memberCache.set(key, member);
    return member;
  }

  private async hasSucceededAttempt(invoiceId: string): Promise<boolean> {
    const { data } = await this.ctx.supabase
      .from("payment_attempts")
      .select("id")
      .eq("stripe_invoice_id", invoiceId)
      .eq("status", "succeeded")
      .limit(1);
    return !!data && data.length > 0;
  }

  /** Add a Stripe-collected invoice payment to payment history (idempotent RPC). */
  private async logSucceededAttempt(memberId: string, inv: Row) {
    const { error } = await this.ctx.supabase.rpc("log_payment_attempt", {
      p_member_id: memberId,
      p_stripe_invoice_id: inv.id,
      p_stripe_payment_intent_id: paymentIntentIdOf(inv),
      p_stripe_charge_id: chargeIdOf(inv),
      p_stripe_subscription_id: subscriptionIdOf(inv),
      p_invoice_number: inv.number ?? null,
      p_amount: (Number(inv.amount_paid) || 0) / 100, // payment_attempts.amount is dollars
      p_currency: inv.currency || "usd",
      p_status: "succeeded",
      p_attempt_number: inv.attempt_count || 1,
      p_succeeded_at: unixToIso(inv.status_transitions?.paid_at) ?? nowIso(),
      p_metadata: {
        charge_type: isAnnualFee(inv) ? "annual_fee" : "membership_dues",
        billing_reason: inv.billing_reason,
        period_start: inv.period_start,
        period_end: inv.period_end,
        recorded_by: "billing_reconciliation",
        reconciliation_run_id: this.ctx.runId,
      },
    });
    if (error) throw new Error(`log_payment_attempt failed for ${inv.id}: ${error.message}`);
  }

  /** After a member's month is settled, lift a past-due membership status the webhook would have lifted. */
  private async reactivateIfClear(memberId: string, inv: Row) {
    const { data: m } = await this.ctx.supabase
      .from("members")
      .select("id, status, payment_past_due")
      .eq("id", memberId)
      .maybeSingle();
    if (!m || m.status !== "past_due" || m.payment_past_due) return null;
    // Same guarded rule the webhook uses: only past_due -> active.
    const { data, error } = await this.ctx.supabase.rpc("apply_billing_status_change", {
      p_member_id: memberId,
      p_target: "active",
      p_reason: `payment_succeeded_reconciled (invoice ${inv.id})`,
      p_stripe_event_id: null,
      p_changed_by: "billing_reconciliation",
    });
    if (error) {
      this.log("could not reactivate member", { memberId, error: error.message });
      return null;
    }
    return data === "changed" ? "active" : null;
  }

  // ── Phase 1: every month the app thinks is owed, checked against Stripe ──────

  async reconcileOpenArrears(): Promise<boolean> {
    const rows: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.ctx.supabase
        .from("billing_arrears")
        .select("id, member_id, stripe_invoice_id, status, amount_due_cents, amount_paid_cents, attempt_count, next_retry_at, billing_type, period_start, period_end")
        .in("status", OPEN_ARREARS_STATUSES)
        .not("stripe_invoice_id", "is", null)
        .order("period_start", { ascending: true })
        .range(from, from + 999);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }

    for (const row of rows) {
      if (this.outOfTime()) return false;
      const inv = await this.getInvoice(row.stripe_invoice_id);
      const before = { status: row.status, amount_paid_cents: row.amount_paid_cents, amount_due_cents: row.amount_due_cents };

      // Bills used to be labelled with the invoice header period (the month
      // before the one billed); correct the dates from the bill's lines.
      if (inv) {
        const period = invoiceServicePeriod(inv);
        if (period.start && (period.start !== row.period_start || (period.end && period.end !== row.period_end))) {
          await this.ctx.supabase.from("billing_arrears")
            .update({ period_start: period.start, period_end: period.end ?? period.start, updated_at: nowIso() })
            .eq("id", row.id);
          row.period_start = period.start;
          row.period_end = period.end ?? period.start;
        }
      }

      if (!inv) {
        await this.record({
          kind: "invoice_missing_in_stripe", action: "needs_review", member_id: row.member_id, stripe_invoice_id: row.stripe_invoice_id,
          message: `Listed as owed (${dollars(row.amount_due_cents)}, ${row.period_start}), but Stripe has no such invoice. It may have been deleted, or created in test mode.`,
          before_state: before,
        });
        continue;
      }

      if (inv.status === "paid") {
        const outOfBand = !!inv.paid_out_of_band;
        const after = {
          status: "paid",
          amount_paid_cents: Number(inv.amount_paid) || row.amount_due_cents,
          paid_at: unixToIso(inv.status_transitions?.paid_at) ?? nowIso(),
        };
        const { error } = await this.ctx.supabase.from("billing_arrears").update({
          ...after,
          stripe_payment_intent_id: paymentIntentIdOf(inv),
          resolved_at: nowIso(),
          resolution_reason: outOfBand
            ? "Marked paid outside Stripe (found by billing reconciliation)"
            : "Paid in Stripe (found by billing reconciliation)",
          failure_code: null, failure_message: null, decline_code: null, next_retry_at: null,
          updated_at: nowIso(),
        }).eq("id", row.id);
        if (error) throw error;

        const recovery = await settleInvoiceRecovery(this.ctx.supabase, row.member_id, inv.id, "Paid in Stripe (billing reconciliation)");
        let historyAdded = false;
        if (!outOfBand && (Number(inv.amount_paid) || 0) > 0 && !(await this.hasSucceededAttempt(inv.id))) {
          await this.logSucceededAttempt(row.member_id, inv);
          historyAdded = true;
        }
        const reactivated = recovery.past_due_cleared ? await this.reactivateIfClear(row.member_id, inv) : null;
        await this.record({
          kind: "marked_paid", action: "corrected", member_id: row.member_id, stripe_invoice_id: inv.id,
          message: `Stripe shows this ${row.billing_type === "annual_fee" ? "annual fee" : "month"} (${row.period_start}) paid${outOfBand ? " outside Stripe" : ""}; the app still listed ${dollars(row.amount_due_cents - (row.amount_paid_cents || 0))} as owed. Marked paid.`,
          before_state: before,
          after_state: { ...after, reminders_stopped: recovery.dunning_recovered, past_due_cleared: recovery.past_due_cleared, payment_history_added: historyAdded, member_status: reactivated },
        });
        continue;
      }

      if (inv.status === "void") {
        const { error } = await this.ctx.supabase.from("billing_arrears").update({
          status: "void", resolved_at: nowIso(), resolution_reason: "Invoice voided in Stripe (found by billing reconciliation)", next_retry_at: null, updated_at: nowIso(),
        }).eq("id", row.id);
        if (error) throw error;
        await this.ctx.supabase.from("payment_dunning_state")
          .update({ status: "abandoned", abandoned_at: nowIso(), updated_at: nowIso(), metadata: { closed_reason: "invoice_void_in_stripe", reconciliation_run_id: this.ctx.runId } })
          .eq("member_id", row.member_id).eq("stripe_invoice_id", inv.id).eq("status", "active");
        const cleared = await reevaluatePastDue(this.ctx.supabase, row.member_id);
        await this.record({
          kind: "marked_void", action: "corrected", member_id: row.member_id, stripe_invoice_id: inv.id,
          message: `Stripe voided this invoice (${row.period_start}), so it is no longer owed. Removed from arrears and reminders stopped.`,
          before_state: before, after_state: { status: "void", past_due_cleared: cleared },
        });
        continue;
      }

      if (inv.status === "uncollectible") {
        const { error } = await this.ctx.supabase.from("billing_arrears").update({
          status: "uncollectible", resolution_reason: "Marked uncollectible in Stripe (found by billing reconciliation)", next_retry_at: null, updated_at: nowIso(),
        }).eq("id", row.id);
        if (error) throw error;
        await this.ctx.supabase.from("payment_dunning_state")
          .update({ status: "abandoned", abandoned_at: nowIso(), updated_at: nowIso(), metadata: { closed_reason: "invoice_uncollectible_in_stripe", reconciliation_run_id: this.ctx.runId } })
          .eq("member_id", row.member_id).eq("stripe_invoice_id", inv.id).eq("status", "active");
        await this.record({
          kind: "written_off_in_stripe", action: "needs_review", member_id: row.member_id, stripe_invoice_id: inv.id,
          message: `Stripe marked this invoice uncollectible and stopped trying to charge ${dollars(inv.amount_remaining ?? row.amount_due_cents)}. Decide whether to collect it another way or forgive it; the member's past-due flag was left as is.`,
          before_state: before, after_state: { status: "uncollectible" },
        });
        continue;
      }

      if (inv.status === "open") {
        const paid = Number(inv.amount_paid) || 0;
        const attempts = Number(inv.attempt_count) || 0;
        const nextRetry = unixToIso(inv.next_payment_attempt);
        const changed = paid !== (row.amount_paid_cents || 0) || attempts !== (row.attempt_count || 0) ||
          (nextRetry ?? null) !== (row.next_retry_at ? new Date(row.next_retry_at).toISOString() : null) ||
          (Number(inv.amount_due) || 0) !== row.amount_due_cents;
        if (changed) {
          const after = {
            amount_due_cents: Number(inv.amount_due) || row.amount_due_cents,
            amount_paid_cents: paid,
            attempt_count: attempts,
            next_retry_at: nextRetry,
            status: row.status === "processing" ? "processing" : paid > 0 ? "partial" : "unpaid",
          };
          const { error } = await this.ctx.supabase.from("billing_arrears").update({ ...after, updated_at: nowIso() }).eq("id", row.id);
          if (error) throw error;
          await this.record({
            kind: "updated_open_invoice", action: "info", member_id: row.member_id, stripe_invoice_id: inv.id,
            message: `Still unpaid in Stripe; refreshed amount, attempts and next retry date from Stripe.`,
            before_state: { ...before, attempt_count: row.attempt_count, next_retry_at: row.next_retry_at }, after_state: after,
          });
        }
        continue;
      }
      // draft (e.g. kept as a draft during a freeze): nothing to reconcile yet.
    }
    return true;
  }

  // ── Phase 2: payments Stripe collected that the app never heard about ─────────

  async recordMissedPayments(): Promise<boolean> {
    const since = Math.floor(Date.now() / 1000) - MISSED_PAYMENT_LOOKBACK_DAYS * 86400;
    let startingAfter: string | undefined;
    do {
      if (this.outOfTime()) return false;
      const page = await this.ctx.stripe.invoices.list({
        status: "paid", created: { gte: since }, limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      for (const raw of page.data) {
        const inv = raw as unknown as Row;
        this.invoiceCache.set(inv.id, inv);
        if (!subscriptionIdOf(inv) || isPtPlan(inv) || inv.paid_out_of_band || !(Number(inv.amount_paid) > 0)) continue;
        if (await this.hasSucceededAttempt(inv.id)) continue;
        const member = await this.memberForInvoice(inv);
        if (!member) {
          await this.record({
            kind: "paid_invoice_no_member", action: "info", stripe_invoice_id: inv.id,
            message: `Stripe collected ${dollars(inv.amount_paid)} on a subscription invoice that does not belong to any member record.`,
            details: { customer: customerIdOf(inv), subscription: subscriptionIdOf(inv), number: inv.number },
          });
          continue;
        }
        await this.logSucceededAttempt(member.id, inv);
        const recovery = await settleInvoiceRecovery(this.ctx.supabase, member.id, inv.id, "Paid in Stripe (billing reconciliation)");
        const reactivated = recovery.past_due_cleared ? await this.reactivateIfClear(member.id, inv) : null;
        await this.record({
          kind: "recorded_missed_payment", action: "corrected", member_id: member.id, stripe_invoice_id: inv.id,
          message: `Stripe collected ${dollars(inv.amount_paid)} on ${unixToDate(inv.status_transitions?.paid_at)} but the app never recorded it. Added to payment history.`,
          after_state: { payment_history_added: true, reminders_stopped: recovery.dunning_recovered, past_due_cleared: recovery.past_due_cleared, member_status: reactivated },
        });
      }
      startingAfter = page.has_more && page.data.length ? page.data[page.data.length - 1].id : undefined;
    } while (startingAfter);
    return true;
  }

  // ── Phase 3: unpaid in Stripe, unknown to the app (review only) ──────────────

  async findUntrackedOpenInvoices(): Promise<boolean> {
    const since = Math.floor(Date.now() / 1000) - UNTRACKED_OPEN_LOOKBACK_DAYS * 86400;
    let startingAfter: string | undefined;
    do {
      if (this.outOfTime()) return false;
      const page = await this.ctx.stripe.invoices.list({
        status: "open", created: { gte: since }, limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      for (const raw of page.data) {
        const inv = raw as unknown as Row;
        if (!subscriptionIdOf(inv) || isPtPlan(inv) || !(Number(inv.attempt_count) > 0)) continue;
        const member = await this.memberForInvoice(inv);
        if (!member) continue;
        if (["cancelled", "expired"].includes(member.status)) continue;
        const { data: tracked } = await this.ctx.supabase
          .from("billing_arrears").select("id").eq("member_id", member.id).eq("stripe_invoice_id", inv.id).limit(1);
        if (tracked && tracked.length > 0) continue;
        await this.record({
          kind: "unpaid_in_stripe_not_tracked", action: "needs_review", member_id: member.id, stripe_invoice_id: inv.id,
          message: `Stripe shows ${dollars(inv.amount_remaining)} unpaid after ${inv.attempt_count} failed attempt${inv.attempt_count === 1 ? "" : "s"}${inv.next_payment_attempt ? ` (next retry ${unixToDate(inv.next_payment_attempt)})` : " (no more retries scheduled)"}, but the app does not list it as owed, so the member is not being reminded. Check the member and the invoice in Stripe.`,
          details: { number: inv.number, period_start: unixToDate(inv.period_start), period_end: unixToDate(inv.period_end) },
        });
      }
      startingAfter = page.has_more && page.data.length ? page.data[page.data.length - 1].id : undefined;
    } while (startingAfter);
    return true;
  }

  // ── Phase 4: past-due flags that disagree with what is owed ──────────────────

  async reconcilePastDueFlags(): Promise<boolean> {
    const { data: flagged, error } = await this.ctx.supabase
      .from("members").select("id, status").eq("payment_past_due", true);
    if (error) throw error;
    for (const m of flagged ?? []) {
      if (this.outOfTime()) return false;
      if (await reevaluatePastDue(this.ctx.supabase, m.id)) {
        await this.record({
          kind: "cleared_past_due_flag", action: "corrected", member_id: m.id,
          message: "Flagged past due, but nothing is owed and no reminders are running. Flag cleared.",
          before_state: { payment_past_due: true }, after_state: { payment_past_due: false },
        });
      }
    }

    const { data: owing, error: owErr } = await this.ctx.supabase
      .from("billing_arrears").select("member_id, amount_due_cents, amount_paid_cents, period_start")
      .eq("status", "unpaid").eq("billing_type", "membership_dues");
    if (owErr) throw owErr;
    const owingIds = [...new Set((owing ?? []).map((r: Row) => r.member_id))];
    for (let i = 0; i < owingIds.length; i += 200) {
      const { data: unflagged } = await this.ctx.supabase
        .from("members").select("id, status").in("id", owingIds.slice(i, i + 200))
        .eq("payment_past_due", false).in("status", ["active", "past_due"]);
      for (const m of unflagged ?? []) {
        const owed = (owing ?? []).filter((r: Row) => r.member_id === m.id)
          .reduce((s: number, r: Row) => s + (r.amount_due_cents - (r.amount_paid_cents || 0)), 0);
        await this.record({
          kind: "owes_but_not_flagged", action: "needs_review", member_id: m.id,
          message: `Owes ${dollars(owed)} in unpaid dues but is not flagged past due. Check whether this is intended (for example an agreed payment plan).`,
        });
      }
    }
    return true;
  }

  // ── Phase: failures whose bill Stripe shows paid ─────────────────────────────

  /**
   * A failed attempt stays "failed" when the success for its invoice never reached
   * the app, or arrived first. Resolve it when Stripe shows the invoice paid.
   */
  async resolveStaleFailures(): Promise<boolean> {
    const { data: rows, error } = await this.ctx.supabase
      .from("payment_attempts")
      .select("id, member_id, stripe_invoice_id, status, amount, created_at")
      .in("status", ["failed", "requires_action"])
      .is("resolved_at", null)
      .not("stripe_invoice_id", "is", null)
      .not("member_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(STALE_FAILURE_BATCH);
    if (error) throw error;
    const seen = new Set<string>();
    for (const a of rows ?? []) {
      if (this.outOfTime()) return false;
      if (seen.has(a.stripe_invoice_id)) continue;
      seen.add(a.stripe_invoice_id);
      const inv = await this.getInvoice(a.stripe_invoice_id);
      if (!inv || (inv.status !== "paid" && inv.status !== "void")) continue;
      let historyAdded = false;
      if (inv.status === "paid" && !inv.paid_out_of_band && (Number(inv.amount_paid) || 0) > 0 && !(await this.hasSucceededAttempt(inv.id))) {
        await this.logSucceededAttempt(a.member_id, inv); // links the failures to this success
        historyAdded = true;
      }
      const recovery = await settleInvoiceRecovery(
        this.ctx.supabase, a.member_id, inv.id,
        inv.status === "paid" ? "Invoice paid in Stripe after this failure (billing reconciliation)" : "Invoice voided in Stripe (billing reconciliation)",
      );
      const reactivated = recovery.past_due_cleared ? await this.reactivateIfClear(a.member_id, inv) : null;
      const period = invoiceServicePeriod(inv);
      await this.record({
        kind: "failure_linked_to_payment", action: "corrected", member_id: a.member_id, stripe_invoice_id: inv.id,
        message: inv.status === "paid"
          ? `A failed attempt on the ${period.start ?? ""} bill was still shown as failed, but Stripe collected that bill${inv.paid_out_of_band ? " (marked paid outside Stripe)" : ""}. Linked to the payment and resolved.`
          : `A failed attempt on the ${period.start ?? ""} bill was still open, but the bill was voided in Stripe. Resolved.`,
        after_state: { attempts_resolved: recovery.attempts_resolved, payment_history_added: historyAdded, reminders_stopped: recovery.dunning_recovered, past_due_cleared: recovery.past_due_cleared, member_status: reactivated },
      });
    }
    return true;
  }

  // ── Phase: standalone payments that should have paid a bill ──────────────────

  /** Members (with their open dues bills) for a batch of Stripe customer ids. */
  private async openDuesInvoices(customerId: string): Promise<Row[]> {
    const open = await this.ctx.stripe.invoices.list({ customer: customerId, status: "open", limit: 20 });
    return (open.data as unknown as Row[])
      .filter((inv) => subscriptionIdOf(inv) && !isPtPlan(inv))
      .sort((x, y) => (x.created ?? 0) - (y.created ?? 0));
  }

  /**
   * Apply a standalone Stripe charge to an open dues bill: the bill is marked paid
   * outside Stripe (so Stripe stops retrying the card) and both are cross-referenced
   * in Stripe metadata so the charge can never be applied twice.
   */
  async applyStandalonePayment(opts: { charge: Row; invoice: Row; memberId: string; appliedBy: string }) {
    const { charge, invoice, memberId } = opts;
    const paid = await this.ctx.stripe.invoices.pay(invoice.id, { paid_out_of_band: true }) as unknown as Row;
    await this.ctx.stripe.invoices.update(invoice.id, {
      metadata: { ...(invoice.metadata ?? {}), paid_by_standalone_charge: charge.id, applied_by: opts.appliedBy },
    });
    await this.ctx.stripe.charges.update(charge.id, {
      metadata: { ...(charge.metadata ?? {}), applied_to_invoice: invoice.id, applied_by: opts.appliedBy },
    });
    const period = invoiceServicePeriod(invoice);
    await this.ctx.supabase.from("billing_arrears").update({
      status: "paid",
      amount_paid_cents: Number(invoice.amount_remaining ?? invoice.amount_due) || 0,
      paid_at: unixToIso(charge.created) ?? nowIso(),
      resolved_at: nowIso(),
      resolution_reason: `Covered by separate charge ${charge.id} on ${unixToDate(charge.created)}`,
      next_retry_at: null,
      updated_at: nowIso(),
    }).eq("member_id", memberId).eq("stripe_invoice_id", invoice.id);
    const recovery = await settleInvoiceRecovery(this.ctx.supabase, memberId, invoice.id, `Covered by separate charge ${charge.id}`);
    const reactivated = recovery.past_due_cleared ? await this.reactivateIfClear(memberId, paid) : null;
    return { period, recovery, reactivated };
  }

  async reconcileStandalonePayments(): Promise<boolean> {
    const since = Math.floor(Date.now() / 1000) - STANDALONE_PAYMENT_LOOKBACK_DAYS * 86400;
    const byCustomer = new Map<string, Row[]>();
    let startingAfter: string | undefined;
    do {
      if (this.outOfTime()) return false;
      const page = await this.ctx.stripe.charges.list({
        created: { gte: since }, limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      for (const raw of page.data) {
        const ch = raw as unknown as Row;
        const customer = typeof ch.customer === "string" ? ch.customer : ch.customer?.id;
        if (ch.status !== "succeeded" || ch.refunded || ch.invoice || !customer) continue;
        if (ch.metadata?.applied_to_invoice) continue;
        if (!DUES_CHARGE_RE.test(`${ch.description ?? ""} ${ch.metadata?.type ?? ""} ${ch.metadata?.payment_type ?? ""}`)) continue;
        byCustomer.set(customer, [...(byCustomer.get(customer) ?? []), ch]);
      }
      startingAfter = page.has_more && page.data.length ? page.data[page.data.length - 1].id : undefined;
    } while (startingAfter);

    for (const [customer, charges] of byCustomer) {
      if (this.outOfTime()) return false;
      const { data: member } = await this.ctx.supabase
        .from("members").select("id, first_name, last_name").eq("stripe_customer_id", customer).limit(1).maybeSingle();
      if (!member) continue;
      let openBills = await this.openDuesInvoices(customer);
      // Bills already marked "paid outside Stripe" that no other charge claims: a
      // standalone payment of the same amount may be what paid them (for example
      // when staff marked the bill paid by hand), so it must not be applied again.
      const oobPaid = (await this.ctx.stripe.invoices.list({
        customer, status: "paid", created: { gte: since - 45 * 86400 }, limit: 50,
      })).data as unknown as Row[];
      const unclaimedOob = oobPaid.filter((inv) => inv.paid_out_of_band && !inv.metadata?.paid_by_standalone_charge);

      for (const ch of charges.sort((a, b) => a.created - b.created)) {
        const amount = Number(ch.amount_captured ?? ch.amount) - Number(ch.amount_refunded || 0);

        // Already applied to a bill by the register (front-desk dues settle their bill).
        const piId = typeof ch.payment_intent === "string" ? ch.payment_intent : ch.payment_intent?.id;
        if (piId) {
          const { data: settledHere } = await this.ctx.supabase
            .from("manual_charges").select("id").eq("stripe_payment_intent_id", piId)
            .not("arrears_settled_at", "is", null).limit(1);
          if (settledHere && settledHere.length > 0) continue;
        }
        // Already accounted for by a bill marked paid outside Stripe.
        const oobIdx = unclaimedOob.findIndex((inv) =>
          Number(inv.amount_paid) === amount && (inv.status_transitions?.paid_at ?? inv.created) >= ch.created - 7 * 86400);
        if (oobIdx >= 0) {
          unclaimedOob.splice(oobIdx, 1);
          continue;
        }

        // Auto-apply only to a bill of exactly this amount that existed when the
        // payment was made or opened within a week of it; anything else is reviewed.
        const exact = openBills.find((inv) =>
          Number(inv.amount_remaining) === amount && (inv.created ?? 0) <= ch.created + 7 * 86400);
        if (exact) {
          const { period, recovery, reactivated } = await this.applyStandalonePayment({ charge: ch, invoice: exact, memberId: member.id, appliedBy: "billing_reconciliation" });
          openBills = openBills.filter((inv) => inv.id !== exact.id);
          await this.record({
            kind: "applied_standalone_payment", action: "corrected", member_id: member.id, stripe_invoice_id: exact.id,
            message: `A ${dollars(amount)} payment on ${unixToDate(ch.created)} ("${ch.description ?? "charge"}") was made as a separate charge, so Stripe kept the ${period.start} – ${period.end} bill open and would have charged the card again. Applied that payment to the bill (marked paid outside Stripe).`,
            after_state: { invoice_status: "paid", reminders_stopped: recovery.dunning_recovered, past_due_cleared: recovery.past_due_cleared, member_status: reactivated },
            details: { charge_id: ch.id, invoice_id: exact.id, amount_cents: amount },
          });
          continue;
        }
        if (openBills.length > 0) {
          const bill = openBills[0];
          const period = invoiceServicePeriod(bill);
          await this.record({
            kind: "standalone_payment_not_applied", action: "needs_review", member_id: member.id, stripe_invoice_id: bill.id,
            message: `${dollars(amount)} was charged separately on ${unixToDate(ch.created)} ("${ch.description ?? "charge"}"), while the ${period.start} – ${period.end} bill (${dollars(Number(bill.amount_remaining))}) is still open and Stripe will keep retrying it. The amounts differ, so it was not applied automatically. If the payment was for this bill, click "Apply to bill".`,
            details: { charge_id: ch.id, invoice_id: bill.id, charge_amount_cents: amount, bill_amount_cents: Number(bill.amount_remaining) },
          });
          continue;
        }
        // No open bill: did Stripe also collect the bill this payment was meant for?
        const paid = await this.ctx.stripe.invoices.list({ customer, status: "paid", created: { gte: ch.created - 45 * 86400 }, limit: 20 });
        const twin = (paid.data as unknown as Row[]).find((inv) =>
          subscriptionIdOf(inv) && !isPtPlan(inv) && !inv.paid_out_of_band &&
          Number(inv.amount_paid) === amount &&
          Math.abs((inv.status_transitions?.paid_at ?? inv.created) - ch.created) <= 45 * 86400);
        if (twin) {
          const period = invoiceServicePeriod(twin);
          await this.record({
            kind: "possible_double_payment", action: "needs_review", member_id: member.id, stripe_invoice_id: twin.id,
            message: `${dollars(amount)} was charged separately on ${unixToDate(ch.created)} and Stripe also collected the ${period.start} – ${period.end} bill (${dollars(amount)}) on ${unixToDate(twin.status_transitions?.paid_at)}, and no open bill is left for it. If both were for the same month, refund one of them in Stripe.`,
            details: { charge_id: ch.id, invoice_id: twin.id, amount_cents: amount },
          });
        }
      }
    }
    return true;
  }

  // ── Staff action: correct the dates on existing bills ───────────────────────

  /**
   * Re-read each bill from Stripe and store the dates it actually covers. Works
   * through rows in id order from `afterId` until the time budget runs out and
   * returns where to continue.
   */
  async fixBillDates(afterId: string | null): Promise<{ checked: number; fixed: number; next_after_id: string | null }> {
    let checked = 0, fixed = 0;
    let cursor = afterId;
    while (!this.outOfTime()) {
      let q = this.ctx.supabase
        .from("billing_arrears")
        .select("id, member_id, stripe_invoice_id, period_start, period_end")
        .not("stripe_invoice_id", "is", null)
        .order("id", { ascending: true })
        .limit(100);
      if (cursor) q = q.gt("id", cursor);
      const { data: rows, error } = await q;
      if (error) throw error;
      if (!rows || rows.length === 0) return { checked, fixed, next_after_id: null };
      for (const row of rows) {
        if (this.outOfTime()) return { checked, fixed, next_after_id: cursor };
        cursor = row.id;
        checked++;
        const inv = await this.getInvoice(row.stripe_invoice_id);
        if (!inv) continue;
        const period = invoiceServicePeriod(inv);
        if (period.start && (period.start !== row.period_start || (period.end && period.end !== row.period_end))) {
          const { error: upErr } = await this.ctx.supabase.from("billing_arrears")
            .update({ period_start: period.start, period_end: period.end ?? period.start, updated_at: nowIso() })
            .eq("id", row.id);
          if (upErr) throw upErr;
          fixed++;
        }
      }
    }
    return { checked, fixed, next_after_id: cursor };
  }

  async run(): Promise<ReconcileSummary> {
    const phases: ReconcileSummary["phases"] = {};
    const steps: Array<[string, () => Promise<boolean>]> = [
      ["open_arrears", () => this.reconcileOpenArrears()],
      ["stale_failures", () => this.resolveStaleFailures()],
      ["standalone_payments", () => this.reconcileStandalonePayments()],
      ["missed_payments", () => this.recordMissedPayments()],
      ["untracked_open_invoices", () => this.findUntrackedOpenInvoices()],
      ["past_due_flags", () => this.reconcilePastDueFlags()],
    ];
    let complete = true;
    for (const [name, step] of steps) {
      if (!complete || this.outOfTime()) { phases[name] = "skipped_time_limit"; complete = false; continue; }
      const done = await step();
      phases[name] = done ? "done" : "skipped_time_limit";
      if (!done) complete = false;
    }
    const by_kind: Record<string, number> = {};
    for (const f of this.findings) by_kind[f.kind] = (by_kind[f.kind] ?? 0) + 1;
    return {
      invoices_checked: this.invoicesChecked,
      corrected: this.findings.filter((f) => f.action === "corrected").length,
      needs_review: this.findings.filter((f) => f.action === "needs_review").length,
      info: this.findings.filter((f) => f.action === "info").length,
      by_kind,
      complete,
      phases,
    };
  }
}
