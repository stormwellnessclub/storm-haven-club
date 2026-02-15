

## Direct Stripe-Synced Failed Payment Admin UI

### Problem

1. **Wafaa Diab**: No actual failed payments in Stripe. Both her payment intents succeeded and her invoice is paid. If the app shows her as "failed," the issue is likely stale local data or a UI bug displaying incorrect status.

2. **No webhook data**: The `payment_attempts` table is empty, meaning the webhook pipeline for logging failures isn't populating data. The current admin Payment Tracking page only reads from this local table, so it always shows empty.

### Solution

Add a new "Stripe Live" tab to the Payment Tracking page that queries Stripe directly via an edge function, bypassing the local database entirely. This gives real-time visibility into failed invoices regardless of webhook reliability.

### Changes

**1. New edge function: `supabase/functions/stripe-failed-invoices/index.ts`**

Accepts admin-authenticated requests and queries the Stripe API directly for:
- Open invoices (`status: 'open'`) -- unpaid/failed
- Uncollectible invoices (`status: 'uncollectible'`)
- Past-due subscriptions
- Optionally filter by date range

Returns invoice details including: customer name/email, amount, due date, attempt count, last failure reason, and associated subscription.

**2. Update `src/pages/admin/PaymentTracking.tsx`**

Add a 5th tab called "Stripe Live" with a lightning bolt icon that:
- Calls the new edge function on mount
- Displays a table of all open/failed invoices directly from Stripe
- Shows: Member Name, Email, Amount, Status, Last Attempt Date, Failure Reason, Invoice ID
- Includes a "Retry Payment" button per row (calls `stripe-payment` with `retry_subscription_invoice`)
- Has a refresh button to re-fetch from Stripe
- Badge showing count of open invoices

**3. Fix webhook logging gap**

Review `supabase/functions/stripe-webhook/index.ts` to verify the `invoice.payment_failed` handler is correctly calling `log_payment_attempt`. Add logging if missing to ensure future failures populate the `payment_attempts` table.

### Technical Details

**Edge Function: `stripe-failed-invoices/index.ts`**

```text
Request: POST with auth header
Body: { dateRange?: { start, end }, status?: 'open' | 'uncollectible' | 'all' }

Response: {
  invoices: [{
    id, customer_id, customer_email, customer_name,
    amount_due, currency, status, created, due_date,
    attempt_count, next_payment_attempt,
    last_failure_message, subscription_id,
    hosted_invoice_url
  }],
  summary: { total_open, total_uncollectible, total_amount_due }
}
```

- Uses `stripe.invoices.list({ status: 'open', limit: 100 })` to get real-time data
- Expands `customer` and `subscription` for display names
- Admin-only: validates user has admin role via Supabase auth

**New Component: `src/components/admin/StripeLivePaymentsTab.tsx`**

- Fetches data from the edge function
- Renders summary cards (Open Invoices count, Total Amount Due, Uncollectible count)
- Table with sortable columns
- "Retry" action button per invoice
- "Open in Stripe" link using `hosted_invoice_url`
- Auto-refresh toggle (every 60 seconds)
- Loading skeleton and error states

**Config update: `supabase/config.toml`**

Add `verify_jwt = false` for the new function (auth validated in code).

| File | Change |
|------|--------|
| `supabase/functions/stripe-failed-invoices/index.ts` | New edge function querying Stripe API directly |
| `src/components/admin/StripeLivePaymentsTab.tsx` | New component for real-time Stripe invoice display |
| `src/pages/admin/PaymentTracking.tsx` | Add "Stripe Live" tab |
| `supabase/functions/stripe-webhook/index.ts` | Verify/fix `invoice.payment_failed` logging |
