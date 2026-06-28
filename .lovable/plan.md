# Add: Cafe Sales by Month Report

Adds a new report to the Reports Center → Financial category that breaks down café revenue by month, including order count, gross sales, estimated 6% MI sales tax, and net (pre-tax) sales.

## What gets built

**New report card** in Reports Center sidebar:
- Name: **Cafe Sales by Month**
- Category: Financial
- Icon: Coffee
- Default date range: Last 12 Months
- No filters

**Report view** (new file `src/components/admin/reports/reports/CafeSalesByMonthReport.tsx`):

1. **Summary tiles** (3 cards across top):
   - Total Gross Sales
   - Total Sales Tax (6% MI, back-calculated)
   - Total Net Sales

2. **Monthly bar chart** — recharts bar chart showing gross sales per month over the selected date range.

3. **Monthly breakdown table** with columns:
   - Month (e.g., "Jun 2026")
   - Orders
   - Gross Sales
   - Sales Tax (6%)
   - Net Sales
   - Totals row at bottom

Data source: `cafe_orders` rows where `status = 'completed'`, filtered by `created_at` within the selected date range, grouped by month in JS.

## Files touched

- `src/lib/reportDefinitions.ts` — add one entry to `REPORTS` array (id `cafe-sales-by-month`, financial category).
- `src/components/admin/reports/ReportPreview.tsx` — add a switch case routing the new id to the new component.
- `src/components/admin/reports/reports/CafeSalesByMonthReport.tsx` — new file.

## Tax calculation note

`cafe_orders.total_amount` stores tax-inclusive totals. Tax is back-calculated as `total / 1.06 * 0.06` and labeled "Estimated 6% MI Sales Tax" in the UI, with a small helper note pointing users to the existing **Sales Tax Collected** report for authoritative Stripe-sourced figures.

## Out of scope

- No DB changes / migrations.
- No changes to the existing **Café Sales Report** (daily) or **Sales Tax Collected** reports.
- CSV export uses the existing Reports Center export button (already wired).
