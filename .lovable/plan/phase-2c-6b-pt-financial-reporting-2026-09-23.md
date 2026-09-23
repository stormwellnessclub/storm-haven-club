# Phase 2C.6B — PT Financial Reporting

Build the reporting layer on top of the existing training payment, installment, package, session and refund records. No new ledger, no duplicated financial rows, no changes to how money is taken.

## Where it lives

`/admin/pt/reports` keeps its route and becomes a six-section workspace with one shared filter bar:

1. Overview
2. Sales
3. Cash Collected
4. Autopay & Accounts Receivable
5. Packages & Unused Session Obligation
6. Trainer Performance

Shared filters: date range (Today, This Week, This Month, Last Month, Quarter, Year, Custom), package, trainer, client, payment status, payment method. Every table exports CSV honouring the active filters. Every row links back to the client billing account, the sold package, the payment, the installment or the invoice.

## The core separation

Sales (contract value), cash collected, and future scheduled autopay are never added together. A $3,600 package on a 4-payment plan with $900 taken today reports Sales $3,600 / Cash $900 / Future scheduled $2,700.

## Section contents

**Overview** — contract value sold, cash collected, future scheduled autopay, past due and failed, refunds, unpaid completed sessions, active clients, sessions completed. Three charts only: cash collected over time, sales vs cash collected, upcoming autopay by week.

**Sales** — one row per sold package: sale date, client, package, trainer attribution (or Unattributed), package total, pay-in-full vs plan, amount due at sale, status. Summary: packages sold, contract value, average package value, pay-in-full count, plan count.

**Cash Collected** — successful money only: date, client, package/session, payment type, method (card / manual / invoice), gross, refunds, net. Excludes scheduled, failed, package-credit usage and waived sessions. A session settled by package credit shows $0 collected.

**Autopay & A/R** — upcoming installments (client, package, due date, amount, status) and failed/past due (client, amount, original due date, failure status, attempts, outstanding). Summary: due next 7 days, next 30 days, total future contracted, past due, failed, total outstanding receivables. Read straight from the stored installment rows; no dates are recalculated.

**Packages & Unused Session Obligation** — client, package, sessions purchased/used/remaining, expiration, amount paid, financial status. Summary: sessions sold, completed, remaining, packages approaching expiration, active packages. Plus an Unused Paid Session Value figure calculated only where the sold agreement supports it, labelled as an operational service-obligation metric, explicitly not an accounting liability.

**Trainer Performance** — two separate blocks. Sessions Delivered (trainer, completed sessions, clients served, volume) from the appointment records. Sales Attribution shown only where an explicit trainer relationship exists on the client's record; everything else is grouped as Unattributed. The attribution rule is printed in the report itself.

## Technical notes

- New hooks under `src/hooks/pt/` for each section; `PTReports.tsx` becomes a section shell reusing the existing PT portal layout and Storm branding.
- Sources: `pt_passes` (sales, package terms, amount paid/outstanding), `pt_payments` + `pt_refunds` (cash and refunds), `pt_payment_plan_installments` (authoritative schedule, past due, failed), `payment_dunning_state` (failure detail), `pt_appointments` / `pt_session_usage` (sessions and unpaid completed), `pt_invoices`, `pt_pass_adjustments`.
- `pt_payments` has no package column, so a payment is tied to a package through its installment row, its invoice's `pass_id`, or the client — the report states which link was used rather than guessing.
- Trainer attribution rule: the explicit active relationship in `pt_client_trainers`; if none exists at the time of sale, Unattributed. Never inferred from who delivered sessions.
- Server-side reporting views (read-only, staff-scoped) so totals aren't capped by client row limits, including a `pt_cash_transactions` view that exposes each collected/refunded training payment in a normalised shape. That view is the documented integration point for club-wide financial reports later — no records copied.

## Verification before finishing

A disposable sandbox sale is used to confirm: the $3,600 / $900 / $2,700 split; a failed installment lands in A/R and not in cash; a successful retry moves it into cash exactly once; a refund reduces net cash; a package-settled session shows $0; remaining sessions match the session ledger; trainer attribution stays empty when unknown; CSV output matches the filtered view. Sandbox data is removed afterwards; no real card, subscription, session balance or appointment is touched.
