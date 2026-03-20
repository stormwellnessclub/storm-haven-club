

## Sales Tax Report — Pull from Stripe

### Problem
The current Sales Tax report queries local `cafe_orders` and `merch_orders` tables for tax line items. These tables are empty or don't contain tax data, resulting in "zero sales tax collected." The actual sales data with tax lives in Stripe.

### Solution
Create an edge function that queries Stripe's API for charges/invoices with tax data, and update the frontend report to call it.

### Changes

#### 1. New Edge Function: `supabase/functions/stripe-sales-tax/index.ts`
- Accepts `start_date` and `end_date` query params
- Uses `STRIPE_SECRET_KEY` (already configured) to call Stripe
- Lists all **charges** (successful) in the date range via `stripe.charges.list()` with `created` date filters
- For each charge, retrieves the associated **invoice** (if any) to get line items with tax
- Also lists **Checkout Sessions** with `payment_status: 'paid'` for one-off purchases (café, merch, class passes)
- Returns an array of items: `{ date, description, subtotal, tax_amount, total, stripe_charge_id }`
- Tax is extracted from Stripe's `invoice.tax` field, or from line items named "Sales Tax" / "MI Sales Tax"
- Falls back to checking `charge.metadata` or calculating 6% if tax is embedded in the total

#### 2. Update `SalesTaxReport.tsx`
- Replace the local DB queries with a single call to the new edge function via `supabase.functions.invoke('stripe-sales-tax', { body: { start_date, end_date } })`
- Display individual line items from Stripe with item descriptions, amounts, and tax
- Keep the existing summary cards (Total Tax, Café/POS Tax, Shop Tax) — populate from Stripe data using metadata/description to categorize
- The date range picker already works in the Report Builder toolbar — the report receives `dateRange` props and will re-fetch when dates change
- Default date range changed to `'last30days'` in reportDefinitions so it shows recent data by default

#### 3. Update `src/lib/reportDefinitions.ts`
- Change `defaultDateRange` for `sales-tax-collected` from `'thisMonth'` to `'last30days'`

### How Stripe data maps
- **Café/POS charges**: Created via `stripe-payment` edge function with metadata like `type: 'cafe_order'` or `type: 'pos_order'`
- **Merch/Shop charges**: Created with metadata `type: 'merch_order'`
- **Class passes**: Created with metadata `type: 'class_pass_purchase'`
- Tax line items are included in Stripe invoices/charges as separate line items named "MI Sales Tax (6%)"

### Security
- Edge function validates auth (admin/manager role required)
- No raw SQL — only Stripe SDK calls
- CORS headers included

