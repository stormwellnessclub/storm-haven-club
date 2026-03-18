

## Problem Summary

Three distinct issues need fixing:

1. **Credit selection picks wrong row**: `useUserCredits` orders by `expires_at ASC` and takes the first match per type — this grabs the **oldest** (soonest-expiring/already-expired) row instead of the current cycle's row. The admin `MemberDetail` page uses `.find()` with no sorting at all, same problem.

2. **Member-facing page shows expired credits**: Customers can see expired credit rows. Only admins should see expired credits and have the ability to extend/reactivate them.

3. **Many members have inconsistent/missing credits**: The webhook renewal uses `invoice.period_start/period_end` from Stripe which may not align with the member's actual billing cycle dates, and the `process-monthly-credits` cron job only catches members whose start day matches today. Members whose billing day doesn't line up with either system end up with wrong or missing credits.

## Plan

### 1. Fix credit selection logic in `useUserCredits.ts`
- Change query ordering from `expires_at ASC` to `expires_at DESC` (newest first)
- Add `credits_remaining > 0` filter for non-expired rows, OR prefer the row with the latest `cycle_start`
- This ensures the member-facing UI always shows current-cycle credits
- The hook already filters `gt("expires_at", now)` so expired rows are excluded for members — this is correct

### 2. Fix admin credit display in `MemberDetail.tsx`
- Change credit query to fetch ALL credits for the member (including expired), ordered by `cycle_start DESC`
- Split the display into two sections:
  - **Current Monthly Credits**: Show only the latest cycle per credit type (where `expires_at > now`)
  - **Expired/Historical Credits**: Show past-cycle credits in a collapsible section, with edit/extend buttons (super_admin only)
- Replace `memberCredits.find(c => c.credit_type === type)` with logic that picks the latest non-expired row per type for the "current" section

### 3. Hide expired credits from member-facing pages
- `useUserCredits.ts` already filters `gt("expires_at", now)` — this is correct, members won't see expired rows
- In `Credits.tsx` (member page), no changes needed since it consumes `useUserCredits` which already excludes expired
- Confirm `Wellness.tsx` and `Dashboard.tsx` also use the hook correctly (they do)

### 4. Fix renewal date consistency
- In `stripe-webhook/index.ts` `invoice.payment_succeeded`: the `cycle_end` calculation subtracts 1 day from `period_end` but the `expires_at` is set to end of that day — this creates dates that don't match the `process-monthly-credits` function's calculation
- Standardize both to use the same date logic: `cycle_end = period_end - 1 day`, `expires_at = end of cycle_end day`
- In `process-monthly-credits/index.ts`: the existing logic is correct but uses `today` as cycle start instead of the member's actual billing anniversary date — fix to use the correct anniversary date

### 5. Backfill missing/incorrect credits
- After code fixes are deployed, run a one-time SQL to identify members with non-Silver tiers who are missing current-cycle credits
- Insert correct credits for any gaps, using each member's billing cycle dates

### Files to modify:
- `src/hooks/useUserCredits.ts` — fix sort order to `DESC`
- `src/pages/admin/MemberDetail.tsx` — split credits into current vs expired sections, restrict expired editing to admin only
- `supabase/functions/process-monthly-credits/index.ts` — use member's anniversary date as cycle_start instead of `today`
- `supabase/functions/stripe-webhook/index.ts` — align cycle date calculation with the standard logic
- Database: one-time backfill query for missing credits

