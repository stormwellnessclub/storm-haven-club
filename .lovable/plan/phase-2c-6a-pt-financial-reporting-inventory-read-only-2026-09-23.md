# Phase 2C.6A — PT Financial Reporting Inventory (read-only)

## 1. Current PT reports / pages / components
- `/admin/pt/reports` (PTReports.tsx + usePTReportData.ts) — operational report: KPIs, by trainer, by package, by client, expiring packages, CSV per table.
- `/admin/pt/billing` (PTBilling.tsx + usePTBillingCenter.ts) — working billing center: unpaid sessions, payment plans, payments, invoices, refunds, failed/past-due; CSV on three tables.
- `/admin/pt/clients/:userId/billing` (PTClientBillingWorkspace) — per-client billing account (B3).
- `/admin/pt` dashboard (usePTDashboardData) — counts only, no money.
- Legacy list pages: PersonalTrainingPasses, PersonalTrainingUnpaid, PersonalTrainingPacks.

## 2. General Storm reports that include PT
None. Reports.tsx, RevenueAnalytics.tsx, PaymentReports.tsx and MemberGrowthReport.tsx contain no PT references — PT money is invisible in club-wide financials.

## 3. Authoritative tables behind current reporting
`pt_passes`, `pt_payments`, `pt_payment_plan_installments`, `pt_refunds`, `pt_invoices`, `pt_appointments`, `pt_session_usage`, `pt_pass_adjustments`, `pt_sale_intents`, `payment_dunning_state`. No reporting views or aggregate RPCs exist — every number is computed client-side from raw rows with row limits (3k–5k).

## 4. Metric status
| Metric | Status |
|---|---|
| PT package sales | EXISTS BUT LIMITED (counted off `activated_at`, not sale date; only in PT Reports) |
| Cash collected | DATA EXISTS BUT NO REPORT (`pt_payments` never enters PTReports; billing page shows a month count only) |
| Revenue by date range | EXISTS BUT LIMITED (contract value, not cash) |
| Revenue by package | EXISTS BUT LIMITED (charged price, not collected) |
| Revenue by trainer | MISSING (`pt_payments` has no pass/trainer link; trainer table is sessions only) |
| Revenue by client | EXISTS BUT LIMITED (session-based, not payments) |
| Payment-plan sales | DATA EXISTS BUT NO REPORT |
| Future scheduled autopay | DATA EXISTS BUT NO REPORT (installment rows exist; billing shows due-7/30 counts only) |
| Successful autopay | DATA EXISTS BUT NO REPORT |
| Failed / past-due autopay | EXISTS AND ACCURATE (billing center + dunning) |
| Outstanding A/R | EXISTS BUT LIMITED (per-pass outstanding; no aggregated A/R with aging) |
| Unpaid completed sessions | EXISTS AND ACCURATE |
| Refunds | EXISTS BUT LIMITED (list + counts, no netting into revenue) |
| Manual / offline payments | DATA EXISTS BUT NO REPORT (`method` captured, never grouped) |
| Discounts / comps / waived | DATA EXISTS BUT NO REPORT (`price_override_cents`, `pt_invoices.discount_cents`, comp adjustments) |
| Sessions sold | EXISTS AND ACCURATE |
| Sessions completed | EXISTS AND ACCURATE |
| Sessions remaining | EXISTS AND ACCURATE |
| Package liability / unused paid sessions | MISSING (no deferred-revenue calculation) |
| Package expirations | EXISTS AND ACCURATE (45-day expiring list) |
| Package renewal rate | MISSING |
| Average PT package value | DATA EXISTS BUT NO REPORT |
| New PT clients | EXISTS BUT LIMITED (client table in window, no first-purchase cohort) |
| Active PT clients | EXISTS BUT LIMITED (activity-based, not entitlement-based) |

## 5. Capabilities of current PT financial reporting
- Date range: YES (PT Reports). Billing center has no date range at all.
- Trainer filter: YES for sessions, NO for money.
- Package filter: NO (grouping only).
- Payment status filter: partial (billing tabs), not a report filter.
- Cash collected vs sales: NO — the two are conflated.
- Future contracted autopay vs collected: NO.
- Package credit usage vs money: partially (session revenue counts paid appointments only), but package-settled sessions are not shown as $0 revenue events.
- CSV export: YES per table (PT Reports, billing center); no combined financial export.

## A. Existing reporting we should keep
PT Reports session/trainer/package operations tables, expiring packages, per-table CSV; the billing center's unpaid sessions, plans, payments, invoices, refunds and failed/past-due tabs; the B3 per-client billing workspace.

## B. Data already exists but needs better UI
Cash collected by date/method, payment-plan sales, scheduled/successful autopay, aggregate A/R with aging, refunds netted, manual vs card, discounts/overrides/comps, average package value, package liability.

## C. Reporting that actually needs to be built
1. A cash-basis PT revenue report (collected, refunded, net) with date range, method and package filters.
2. Sales vs cash vs contracted-future reconciliation (sale value, collected to date, scheduled autopay, outstanding).
3. Deferred revenue / package liability (unused paid sessions valued per pass).
4. Trainer revenue attribution — needs a pass/trainer link on payments before it can be accurate.
5. Renewal rate and new-vs-returning PT client cohorts.
6. Roll PT into club-wide financials (or at least the sales-tax/revenue reports).
7. Server-side aggregates (views/RPCs) so totals aren't capped by client row limits.

## D. Recommended navigation inside /admin/pt
- Billing (existing operational workspace)
- Reports → tabs: Operations (current), Revenue (cash basis), Sales & Contracts, Liability & Expirations, Clients & Retention
- Keep per-client billing reachable from every report row.
