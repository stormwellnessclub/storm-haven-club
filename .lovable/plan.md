# Phase 2C.6B — PT Financial Reporting: Completion and Verification Report

This is the report delivered when Phase 2C.6B finished, resent here. It doesn't include any new build work.

## Routes and components built
- `/admin/pt/reports`: a tabbed workspace with one shared filter bar. Filters: date presets (Today, This Week, This Month, Last Month, Quarter, Year, Custom), package, trainer (including "Unattributed"), client, payment status, payment method.
- The six financial sections, plus the earlier operations report kept as its own tab.
- Shared filter logic and new report data hooks.

## Reports built
1. **Overview:** 8 key numbers. Charts for cash collected over time, sales vs cash, and upcoming autopay.
2. **Sales:** one row per package sold. Pay-in-full vs plan, amount due at sale, and trainer attribution or Unattributed.
3. **Cash Collected:** successful payments only, showing gross, refunds and net. Sessions paid from a package count as $0.
4. **Autopay & Accounts Receivable:** upcoming payments, failed and past-due payments, and totals for the next 7 and 30 days, all future autopay, and total owed.
5. **Packages & Unused Session Obligation:** sessions bought, used and remaining; expiration; amount paid. Also the value of paid sessions not yet used, labeled as a service obligation, not an accounting liability.
6. **Trainer Performance:** sessions delivered is shown separately from sales attribution.

Every detail table has a CSV export that follows the active filters. Rows link back to the client's billing account, the package, the payment, the scheduled payment or the invoice.

## Source records used
Existing training records only: packages sold, payments, refunds, scheduled payment rows (read as stored, dates never recalculated), appointments, session usage, invoices, client–trainer links and failed-payment tracking. One new read-only view normalizes collected money and refunds. No new ledger, no copied rows.

## Club-wide integration point
The new cash transactions view lists every collected training payment and refund in a standard format. The main club financial reports can pull from it later without copying any records.

## Attribution rule
Sales are credited to a trainer only when the client's record has an explicit, active trainer relationship. Everything else shows as Unattributed. Delivering a session never counts as sales credit.

## Acceptance checks
All 8 were run on temporary test data, which was deleted afterwards. No real client, card, subscription or session balance was touched.

| # | Check | Result |
|---|---|---|
| 1 | $3,600 plan sale with $900 collected shows Sales $3,600 / Cash $900 / Future $2,700 | PASS |
| 2 | A failed future payment appears in A/R, not in cash collected | PASS |
| 3 | A successful retry moves that amount into cash collected exactly once | PASS |
| 4 | A refund reduces net cash correctly ($1,800 − $250 = $1,550) | PASS |
| 5 | A session paid from a package shows $0 new cash | PASS |
| 6 | Sessions remaining match the session ledger (22 = 22) | PASS |
| 7 | Trainer reporting never invents attribution | PASS |
| 8 | CSV exports match what's shown with the same filters | PASS |

## Defect found and fixed during verification
The same refund was showing on every payment in a package. Each refund now attaches only to the payment it came from.

## Follow-up fixes after completion
- Staff can now sell a payment plan to a brand-new client. A billing record is created for them automatically.
- Clearing or typing a custom date no longer breaks the reports page.

## Remaining limitations
- Trainer revenue depends on the explicit client–trainer relationship, because payments don't record a trainer.
- A refund counts in the date range when it happened. A refund issued in a later period shows up in that later range.
- Totals are added up in the browser. There's room for 5,000 payments or sessions in one date range before anything would be missing. Current volume is far below that.

PHASE 2C.6B STATUS: COMPLETE
