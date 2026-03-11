

# Daily Sales Breakdown Report — Detailed, Item-Level

## What We're Building
A new **"Daily Sales Breakdown"** report that gives you a thorough, item-level view of every revenue stream for any selected date range. Each category (Cafe, Merch, Classes, Guest Passes, Memberships) gets its own clearly separated section with individual item/transaction detail — no overlapping text, no overcrowded layout.

## Layout & UX Approach
- **Top summary row**: 5 stat cards showing total revenue per category at a glance (Cafe, Merch, Classes, Guest Passes, Memberships) plus a grand total
- **Tabbed sections below** (using the existing Tabs component): One tab per revenue area so nothing overlaps — the admin clicks "Cafe", "Merch", "Classes", etc. to drill into that area
- Each tab contains:
  - A summary card (total revenue, order count, avg order value)
  - An **item-level table** showing every individual sale/transaction with date, item names, quantities, amounts
  - For Cafe & Merch: items are extracted from the `order_items` JSON and aggregated into a "Top Items" ranking table (item name, qty sold, total revenue)
  - For Classes: grouped by class type/category with pass counts and revenue
  - For Guest Passes: individual pass sales with guest name, date, amount
  - For Memberships: each charge with member name, description, amount
- Clean spacing between sections, no side-by-side layouts that cause overlap on smaller screens — everything stacks vertically within each tab
- Responsive: single-column layout throughout

## Data Sources (all existing)
- `cafe_orders` → `order_items` JSON has item names, prices, quantities
- `merch_orders` → `order_items` JSON has product names, sizes, colors, prices, quantities
- `class_passes` → `category`, `pass_type`, `price_paid`, `purchased_at`
- `guest_passes` → `guest_name`, `price_paid`, `purchased_at`, `status`
- `manual_charges` → `amount`, `description`, `created_at` (membership dues, initiation, annual fees)
- `members` → joined for member names on charges

## Files to Create/Modify
1. **`src/components/admin/reports/reports/DailySalesBreakdownReport.tsx`** — New report component with tabbed layout and item-level queries
2. **`src/lib/reportDefinitions.ts`** — Add the new report definition under 'financial' category
3. **`src/components/admin/reports/ReportPreview.tsx`** — Register the new component in the report router

## Technical Details
- Single `useQuery` per tab (lazy-loaded when tab is active) to avoid fetching all data at once
- Item aggregation done client-side from the JSON `order_items` arrays
- Currency formatting consistent with existing reports (`Intl.NumberFormat`)
- Default date range: `today` (since it's a daily breakdown)
- Tables use the existing shadcn `Table` components with proper column alignment

