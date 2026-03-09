

# Sync Autopay Schedule with Real Stripe Billing Dates

## Problem
The Autopay tab calculates upcoming billing dates by looping `addMonths` from `membership_start_date`, but Stripe bills on the **subscription creation anniversary**, which is often a different day. This causes the report to show wrong dates (or appear empty for today).

## Approach
Create an edge function that batch-fetches `current_period_end` from Stripe for all active subscriptions, then use that as the billing anchor instead of `membership_start_date`.

**This is read-only from Stripe's perspective — no billing dates or amounts are changed.**

## Implementation

### 1. New Edge Function: `supabase/functions/get-autopay-dates/index.ts`
- Accepts a JSON array of `stripe_subscription_id` strings
- For each, calls `stripe.subscriptions.retrieve(id)` to get `current_period_end`
- Returns a map: `{ [subscription_id]: next_billing_date_iso }`
- Batches in parallel (Promise.all) for speed
- Uses existing `STRIPE_SECRET_KEY` secret

### 2. Update `src/hooks/useAutopaySchedule.ts`
- After fetching active members, collect all `stripe_subscription_id`s
- Call `get-autopay-dates` edge function with those IDs
- For each member, use the returned `current_period_end` as the **anchor** for the next billing date
- Project subsequent months forward from that anchor (`addMonths(anchor, 1)`, `addMonths(anchor, 2)`, etc.)
- Fall back to `membership_start_date` calculation if Stripe data is unavailable for a member

### 3. Register edge function in `supabase/config.toml`
```toml
[functions.get-autopay-dates]
enabled = true
verify_jwt = false
```

## Files
- **New**: `supabase/functions/get-autopay-dates/index.ts`
- **Edit**: `src/hooks/useAutopaySchedule.ts` — use real Stripe billing anchors
- **Edit**: `supabase/config.toml` — register new function

