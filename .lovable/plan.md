

## Plan: Fix Payment Method Form Not Loading in Portal

### Root cause
The `stripe-config` edge function has outdated CORS headers. The Supabase JS client sends additional headers (`x-supabase-client-platform`, `x-supabase-client-platform-version`, etc.) that aren't in the function's `Access-Control-Allow-Headers` list. This causes the browser's preflight (OPTIONS) request to fail, so the `StripeProvider` can't fetch the Stripe publishable key and the payment form never loads.

### Fix

1. **Update CORS headers in `supabase/functions/stripe-config/index.ts`** to match the headers used in `stripe-payment/index.ts`:
   ```
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version"
   ```

2. **Redeploy the function** (automatic on save)

### Why this fixes it
When the portal user clicks "Add Payment Method", the dialog opens and `StripeProvider` tries to call `stripe-config` to get the publishable key. The CORS preflight fails because the browser sends headers the function doesn't allow, so Stripe never initializes and the form shows "Payment system is not configured" or stays on the loading spinner indefinitely.

