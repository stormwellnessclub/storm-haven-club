# Freeze dues recovery job + Cancelled Members balance report

## 1. Nightly freeze draft-invoice finalizer

A new nightly job catches what happened with Jana, Mariam and Rola: a freeze ends, but Stripe still has collection paused, so the dues invoice sits as a draft and nobody is charged.

Every night (right after the existing freeze-expiration run), for each member whose freeze has ended:

- Lift any leftover Stripe collection pause on the dues subscription.
- Find draft dues invoices on that subscription.
- Leave invoices that cover the frozen period alone (unbilled) and finalize + charge the post-freeze cycle invoices.
- Record every outcome — charged, declined, skipped — so nothing is silent.

When a charge fails (Rola's declined $515.25), the job records the failure, the invoice stays open in the normal dunning/retry flow, and the member appears in Billing Arrears with the amount owed.

## 2. Freeze billing recovery tracking

A new record is written per invoice the job touches: member, freeze, invoice number, amount, action taken, result, and the decline reason if any. This history is visible in the admin billing area so you can see at a glance which freeze-end charges went through and which failed.

## 3. Cancelled Members balance report

A report on the Cancelled Members page showing:

- How many people on the cancelled list carry a balance, and the total outstanding.
- Per person: name, amount outstanding, and the date their next dues invoice is due (from Stripe, when the subscription is still live) or "no upcoming invoice" when Stripe is fully stopped.
- CSV export, matching the other billing reports.

## Technical notes

- New edge function `reconcile-freeze-dues` (trusted-caller only, same internal-token pattern as `process-freeze-expirations`). Steps per member with a `completed`/expired freeze in the last 60 days: retrieve subscription, clear `pause_collection` if present, list `draft` invoices for the subscription, classify each by `period_start`/`period_end` against the freeze window, void/skip in-freeze drafts, set `auto_advance: true` and finalize + pay post-freeze drafts.
- Failures write to `billing_arrears` and `payment_attempts` using the existing helpers so `process-payment-dunning` picks them up unchanged.
- New table `freeze_billing_recoveries` (member_id, freeze_id, stripe_invoice_id, invoice_number, amount_cents, action, outcome, failure_reason, created_at) with RLS + GRANTs limited to admin/manager roles.
- New `pg_cron` job at 07:30 UTC daily (30 minutes after `process-freeze-expirations-daily` at 07:00 UTC), one run per day, so no added recurring cost beyond a single nightly call.
- Report: new component under the Cancelled Members page reading `members` filtered on `records_cancelled_at`, joined to `billing_arrears` for outstanding balance; next-invoice dates fetched in one batched call to a small edge function that reads `upcoming invoice`/`next_pending_invoice_item_invoice` per subscription. All dates rendered in `America/Detroit`.
