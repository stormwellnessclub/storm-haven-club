

# Fix Café Sales Report — Use Actual Stripe Sales Data

## Problem
The Café Sales Report queries `cafe_orders` which has only 4 records (3 cancelled, 1 pending). All real café sales go through the POS via `charge_saved_card` and land in `manual_charges` with descriptions starting with "Cafe -". There are dozens of real transactions there that the report completely ignores.

## Root Cause
The POS charges the card via Stripe first, then creates a `cafe_orders` record — but the `cafe_orders` insert is unreliable (RLS issues, errors swallowed by `as any` casting). The actual source of truth for café revenue is `manual_charges` where `description LIKE 'Cafe %'` and `status = 'succeeded'`.

## Fix — Dual-Source Query

Update `src/components/admin/reports/reports/CafeSalesReport.tsx` to pull from **both** `cafe_orders` (for any legitimate orders) **and** `manual_charges` (for Stripe-processed POS sales):

### 1. Add `manual_charges` query
- Query `manual_charges` where `description ILIKE 'Cafe%'` and `status = 'succeeded'` within the date range
- Parse item names from the description field (format: `Cafe - ItemName - Variant - (Size) | Cafe - ItemName2...`)
- Convert amounts from cents to dollars (`amount / 100`)

### 2. Parse item details from descriptions
The descriptions follow a pattern: `Cafe - Matcha - Vanilla | Cafe - Latte - (20oz) (incl. MI 6% tax)`
- Split by ` | ` to get individual items
- Extract item name (second segment after "Cafe - ")
- This enables the per-item breakdown and top-selling items table

### 3. Merge data sources
- Use `manual_charges` as the primary revenue source (it has real Stripe-confirmed payments)
- Fall back to `cafe_orders` for any orders not captured in manual charges (e.g., cash sales)
- Deduplicate by checking `payment_intent_id` if both sources have the same transaction

### 4. Keep existing UI intact
- Same summary cards (Total Revenue, Total Orders, Avg Order Value, Tax Collected)
- Same daily trend chart, top items table, category breakdown, payment method split, and order log
- Revenue figures will now reflect actual Stripe charges

## Result
The Café Sales Report will show all real sales data — the dozens of daily transactions currently invisible — with accurate revenue totals and per-item breakdowns parsed from Stripe charge descriptions.

