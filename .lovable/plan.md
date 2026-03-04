

# Enhanced Tracking and Projections Dashboard

## What You're Asking For

1. **Application tracking with goal projections** — track application volume over time and project when you'll hit membership targets
2. **Guest pass tracking** — volume, revenue, trends
3. **Class pass tracking** — volume, revenue, trends
4. **Daily revenue from all sales** — broken down by area (cafe, spa, classes, guest passes, memberships)

## What Already Exists vs What's Missing

| Feature | Status |
|---------|--------|
| New Applications report | Exists but basic — just a list with a line chart. No conversion rate, no goal projection |
| Guest Pass Usage report | Exists but no revenue tracking or trends |
| Sales Segmentation report | Exists with category breakdown but no daily view |
| Daily revenue by area | Does not exist |
| Membership goal projection | Does not exist |

## Changes

### 1. New Report: "Daily Revenue Breakdown" (`DailyRevenueReport.tsx`)

A new report showing revenue per day, broken down by source area with a stacked bar chart.

- Query all revenue sources (cafe orders, spa appointments, class passes, guest passes, manual charges, subscription payments) grouped by date
- Stacked bar chart: each bar is a day, segments colored by area
- Summary cards: Today's revenue, period average, best day
- Table with daily totals and per-area columns
- Register as `daily-revenue` in `reportDefinitions.ts` under `financial` category and wire into `ReportPreview.tsx`

### 2. Enhance: "New Applications Report" (`NewApplicationsReport.tsx`)

Add goal-based projection and conversion metrics:

- **Conversion funnel cards**: Total Applications, Approved, Activated, Conversion Rate
- **Goal projection**: Add an input for target member count (e.g., 500). Based on current application rate (apps per week over selected period) and conversion rate, calculate projected date to reach goal. Display as a prominent card: "At current pace, you'll reach 500 members by [date]"
- **Cumulative growth line**: Add a second line showing cumulative approved members over time alongside daily applications

### 3. Enhance: "Guest Pass Usage Report" (`GuestPassUsageReport.tsx`)

Add revenue and trend data:

- **Revenue card**: Total revenue from paid guest passes in the period
- **Trend line chart**: Daily/weekly guest pass sales (count and revenue) over the date range
- **Avg revenue per pass** metric

### 4. New Report: "Class Pass Sales" (`ClassPassSalesReport.tsx`)

Dedicated class pass tracking (currently only exists as a sub-table in Sales Segmentation):

- Summary cards: Total passes sold, Total revenue, By category (Pilates/Cycling/Aerobics), Member vs Non-member split
- Bar chart: sales by category
- Trend line: weekly pass sales over time
- Register as `class-pass-sales` in `reportDefinitions.ts` under `services` category and wire into `ReportPreview.tsx`

### 5. Fix: Revenue reports use `subscription_status` filter

In `RevenueSummaryReport.tsx`, `CashFlowProjectionReport.tsx`, and `NextMonthProjectionReport.tsx`:
- Add `subscription_status` to the select query
- Post-filter non-founding members to only include those with `subscription_status = 'active'` and a valid `stripe_subscription_id`
- Show a warning count of "active but not paying" members

### 6. Fix: Pie chart overlap in `RevenueByCategoryReport.tsx`

- Increase container height from 300 to 450
- Increase `outerRadius` from 100 to 150
- Remove inline `label` prop (the one causing overlap), keep `Legend` and `Tooltip`

### Files to create
- `src/components/admin/reports/reports/DailyRevenueReport.tsx`
- `src/components/admin/reports/reports/ClassPassSalesReport.tsx`

### Files to modify
- `src/lib/reportDefinitions.ts` — add 2 new report entries
- `src/components/admin/reports/ReportPreview.tsx` — import and register 2 new components
- `src/components/admin/reports/reports/NewApplicationsReport.tsx` — add goal projection + conversion funnel
- `src/components/admin/reports/reports/GuestPassUsageReport.tsx` — add revenue tracking + trends
- `src/components/admin/reports/reports/RevenueSummaryReport.tsx` — filter by `subscription_status`
- `src/components/admin/reports/reports/CashFlowProjectionReport.tsx` — filter by `subscription_status`
- `src/components/admin/reports/reports/NextMonthProjectionReport.tsx` — filter by `subscription_status`
- `src/components/admin/reports/reports/RevenueByCategoryReport.tsx` — fix pie chart sizing/overlap

### No database changes needed.

