## What happened

Summer Alyaishi's June cycle had **2 Red Light credits remaining** (cycle 6/5 – 7/4). When you used **"Grant pass/credit"** to add 1 more red light, the code inserted a brand-new `member_credits` row (1/1, cycle 6/9 – 7/9) instead of bumping the existing row. The portal/booking only reads the newest-cycle row per type, so her 2 older credits effectively disappeared from view.

The 2 credits are NOT gone from the database — they're still on the 6/5 cycle row.

## Fix

### 1. Restore Summer's balance (data fix)
- Merge the new grant into her existing cycle: set the 6/5 row to **3 remaining / 5 total**.
- Delete the orphan 6/9 row.
- Log a `credit_adjustments` entry tying the +1 to her real cycle row.

### 2. Fix the root cause — `src/components/admin/AdminGrantPassDialog.tsx`
For red_light / dry_cryo / guest_pass grants, before inserting, look up the member's active (non-expired, `credits_remaining > 0`) credit row of that type:
- If one exists → `UPDATE member_credits SET credits_total = credits_total + qty, credits_remaining = credits_remaining + qty` on that row, and log to `credit_adjustments`.
- If none exists → insert a new row as today (unchanged behavior).

This matches how `MemberDetail.tsx` and `MemberCredits.tsx` "Add credits" already work, and keeps a single active row per credit type so the portal shows the correct total.

### 3. No schema or RLS changes
Pure frontend logic fix + a one-off data correction insert.

## Out of scope
- Not changing `useUserCredits` aggregation. Keeping "one active row per type" is the cleaner invariant the rest of the app already assumes.
