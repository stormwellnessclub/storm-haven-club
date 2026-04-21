

## Issue: Sales Tax report returns 401 from edge function

### Root cause

The `stripe-sales-tax` edge function is returning **401 Unauthorized** on every recent call. Edge logs confirm this — 7 consecutive `401` responses since the last successful 200 (which took 55 seconds to complete and likely also caused timeout issues).

Two distinct problems:

**1. Auth lookup is failing inside the function.** The function calls `supabase.auth.getUser()` to verify the caller, but it's returning a null user even though the report page requires admin login. Most likely cause: when invoked from the browser, `supabase.functions.invoke()` sends the user's JWT in `Authorization`, but the function is creating its Supabase client with `SUPABASE_ANON_KEY` and forwarding the header — if the session token is expired or missing, `getUser()` silently returns null and the function 401s without a useful message.

**2. The frontend swallows the real error.** `SalesTaxReport.tsx` uses `supabase.functions.invoke()`, which on non-2xx responses throws a generic `FunctionsHttpError` ("Edge Function returned a non-2xx status code") and discards the JSON body — so the actual `{ error: "Not authenticated" }` message never reaches the UI.

A secondary concern: the previous successful call took **55 seconds** because the function loops through every Stripe charge in the date range AND retrieves the full invoice for each one. Large date ranges will time out (edge functions cap at 60s wall time).

### Fix plan

**A. Make the edge function return errors as HTTP 200 with `{ ok: false, error }`** so the frontend can read the real message instead of "non-2xx status code". (Matches the project's existing pattern for Stripe edge functions per memory.)

**B. Fix the auth check** — verify the user via the JWT properly:
- Use the service role key for the Supabase client (read-only role check)
- Extract the bearer token, call `auth.getUser(token)` explicitly
- Return clear messages: "Session expired, please sign in again" vs "Not authorized for this report"

**C. Update `SalesTaxReport.tsx`** to read `data.ok === false` and surface `data.error` in the existing error alert, instead of relying on `error.message`.

**D. Performance hardening** to avoid the 55s+ runs:
- Cap the date range to 31 days max per request (return a friendly error if exceeded)
- Skip the per-charge `stripe.invoices.retrieve()` call unless the charge actually has an invoice AND no tax was found in metadata first — most café/POS/shop charges have tax in `metadata.tax_amount` already
- Add a hard timeout guard at 50 seconds that returns partial results with a "showing first N charges" notice

### Files to change

- `supabase/functions/stripe-sales-tax/index.ts` — auth fix, 200-with-ok pattern, performance guards, date-range cap
- `src/components/admin/reports/reports/SalesTaxReport.tsx` — read `data.ok/data.error`, show real error message, show partial-results notice when applicable

### What you should see after

- Loading the Sales Tax report works without the generic "non-2xx" error
- If something is genuinely wrong (expired session, no Stripe key), you'll see the actual reason
- Reports for a typical month return in under 10 seconds instead of 55+

