

# Auto-Realign Billing Date When Freeze Ends

## The Problem

Right now, when a freeze ends (either automatically via `process-freeze-expirations` or manually via "End Freeze Early"):
1. The subscription is resumed (`pause_collection: null`)
2. But the **billing anchor stays at the original date** -- so the member immediately gets charged on their old cycle date

This means you have to manually go into Stripe and shift the billing date for every frozen member. That's what happened with Afifa — her subscription was paused but when it resumes, Stripe would charge on the old anniversary (March 9), not the freeze end date (March 31).

**About Afifa specifically**: Since you already shifted her next payment to March 31st using Stripe, future months WILL follow from March 31st. The `trial_end` approach resets the billing cycle anchor when it expires, so April will be ~April 30, May ~May 31, etc. She's fine going forward.

## The Fix

After resuming a subscription, automatically call `update_billing_anchor` to shift the next charge to the freeze end date. This applies to both:

1. **`useEndFreezeEarly` hook** (admin manually ends freeze) — shift billing to today
2. **`process-freeze-expirations` edge function** (automatic expiry) — shift billing to the `actual_end_date`

### Files to modify

**`src/hooks/useAdminFreezeRequests.ts`** — in `useEndFreezeEarly`:
- After calling `resume_subscription`, call `update_billing_anchor` with today's date for the membership subscription
- Do the same for the annual fee subscription if it exists

**`supabase/functions/process-freeze-expirations/index.ts`** — after each `resume_subscription` call:
- Call `update_billing_anchor` with the freeze's `actual_end_date` for both membership and annual fee subscriptions

### What this changes

- **Before**: Admin must manually shift billing dates in Stripe after every freeze ends
- **After**: Billing date automatically realigns to the freeze end date; future monthly charges follow from there

No database changes needed. Two files, adding ~20 lines each to chain the billing anchor update after resume.

