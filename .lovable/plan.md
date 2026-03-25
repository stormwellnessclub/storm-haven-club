

# Add Dedicated Café Sales Report

## What you'll get

A new report called **"Café Sales Report"** in the Financial (or a new "Café" category — but keeping it under Financial makes more sense since there are few reports). It will be a standalone, full report — not a tab inside Daily Sales Breakdown.

### Sections in the report:

1. **Summary Cards** — Total revenue, total orders, avg order value, total tax collected (6% MI)
2. **Daily Sales Trend** — Bar chart or table showing revenue per day across the date range
3. **Top Selling Items** — Ranked table: item name, qty sold, revenue, % of total sales
4. **Sales by Category** — Breakdown by café menu categories (drinks, food, etc.) from `order_items` category field
5. **Tax Summary** — Total taxable sales, tax collected (6%), with daily breakdown
6. **Payment Method Breakdown** — Card vs cash vs member account split
7. **Individual Orders** — Detailed order log (date/time, items, total, payment method, status)

All data comes from the `cafe_orders` table — no new tables or migrations needed.

## Plan

### 1. Add report definition to `src/lib/reportDefinitions.ts`
- Add `'cafe-sales'` report under `'financial'` category with Coffee icon
- Default date range: `'today'`
- No filters needed (date range is sufficient)

### 2. Create `src/components/admin/reports/reports/CafeSalesReport.tsx`
- Query `cafe_orders` for the selected date range (status in completed/ready/preparing)
- Compute:
  - Summary stats (revenue, orders, avg, tax at 6%)
  - Daily revenue aggregation (group by date)
  - Item-level aggregation from `order_items` JSON (name, qty, revenue, category)
  - Category-level aggregation
  - Payment method counts
- Render all sections with spacious cards and tables

### 3. Register in `src/components/admin/reports/ReportPreview.tsx`
- Import `CafeSalesReport` and add `'cafe-sales'` to the `reportComponents` map

## Files to change
- **Edit**: `src/lib/reportDefinitions.ts` — add café sales report definition
- **New**: `src/components/admin/reports/reports/CafeSalesReport.tsx` — full report component
- **Edit**: `src/components/admin/reports/ReportPreview.tsx` — register the component

