

## Fix: Credits Visibility + Admin & Member Class Booking with Credits

### Root Cause Analysis

There are 4 distinct issues to fix:

**Issue 1 — Admin Credits tab shows "No active credits" for some members**
The `MemberDetail.tsx` credits query is correct (queries by `member_id`), but some imported credit records were inserted with a NULL `user_id`. The query itself works fine, so the UI showing zeros is likely due to a RLS policy blocking reads when `user_id` is NULL. Staff should always be able to see all credits regardless of `user_id`. A secondary issue is that the credit grid only shows the 4 standard types and hides any rows that don't have a credit — it's not obvious if credits are missing vs. just zero.

**Issue 2 — BookingModal shows "No payment method" for Diamond members with class credits**
`useAvailableCreditsForCategory` → `useUserCredits` fetches the member, then only returns class credits when `memberStatus === 'active'`. However, the `classCredits` query requires `member_id` match. The `useUserCredits` hook fetches the member where `user_id = auth.uid()`, then fetches credits by `member_id`. This is correct — **but** the `BookingModal` calls `canUseMemberCredits = creditsData?.hasClassCredits`, which requires `memberStatus === 'active'`. If a Diamond member's status is technically `active` and they have class credits, this should work. Let me re-examine what actually fails.

The real bug: `useUserCredits` queries `member_credits` by `member_id` with `gt("expires_at", now())`. The credits in the DB have `expires_at` around March 16-18. Today is Feb 20. So those credits should be visible. The issue is likely **RLS on `member_credits`** — members cannot read their own credit records because the RLS policy requires a staff role or matching `user_id`, but some credit records have `user_id = NULL`.

**Issue 3 — Admin "Book Session" only works for red light / dry cryo, not class credits**
The `showAdminBookWellnessDialog` in `MemberDetail.tsx` only presents "Red Light Therapy" and "Dry Cryotherapy" as options. There is no way to book a class session for a member using their class credits from the admin panel.

**Issue 4 — No credit usage history for members**
The member-facing `Credits.tsx` page shows current balances but has no history section showing past credit usage (which classes they booked, when credits were deducted).

---

### Fixes

#### Fix 1 — RLS: Ensure members can read their own `member_credits`

The `member_credits` table has credits where `user_id` may be NULL (manually imported). The RLS SELECT policy needs to allow members to read credits where `member_id` matches their linked member record, not just where `user_id = auth.uid()`.

Add a new migration that updates the RLS policy to use a subquery:

```sql
-- Allow members to read their own credits via member_id lookup
-- (handles credits where user_id may be NULL)
DROP POLICY IF EXISTS "Members can view own credits" ON member_credits;

CREATE POLICY "Members can view own credits"
ON member_credits FOR SELECT
USING (
  -- Staff can see all
  has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk','staff']::app_role[])
  OR
  -- Member can see if user_id matches
  user_id = auth.uid()
  OR
  -- Member can see via member_id lookup (handles NULL user_id on credit records)
  member_id IN (
    SELECT id FROM members WHERE user_id = auth.uid()
  )
);
```

#### Fix 2 — Admin "Book Session": Add class credit booking to admin panel

Extend the `showAdminBookWellnessDialog` to include "Class" as a service type. When "Class" is selected, instead of a date/time picker for a spa appointment, show a class session selector that lets the admin pick an upcoming class session and book the member into it using their class credit. This uses the existing `create_atomic_class_booking` RPC with `payment_method = 'credits'`.

Changes to `src/pages/admin/MemberDetail.tsx`:
- Extend `adminBookServiceType` type to `"red_light" | "dry_cryo" | "class"`
- Add a class session search/selector when "class" is selected
- Add a query to fetch upcoming class sessions (next 14 days) for the session selector
- When booking with class credits, call `supabase.rpc('create_atomic_class_booking', {...})` instead of directly inserting into `spa_appointments`
- The RPC handles member lookup by `user_id`, so pass `member.user_id`

#### Fix 3 — Member Credits page: Add usage history

Add a "Credit History" section at the bottom of `src/pages/member/Credits.tsx` that shows:
- Class bookings made with credits (from `class_bookings` where `member_id` matches and `credits_used > 0`)
- Wellness appointments booked with credits (from `spa_appointments` where `member_id` matches and `payment_method = 'credit'`)
- Manual adjustments (from `credit_adjustments` where `member_id` matches)

#### Fix 4 — Admin Credits tab: Show ALL credit types clearly, including class passes

Enhance the admin Credits tab grid to:
- Show all 4 credit types always (even if 0), with a clear "No credits" state
- Show class passes below the credit grid (a list of active `class_passes` for this member)
- Show credit adjustments in a timeline format

---

### Files to Modify

| File | Change |
|------|--------|
| Migration | Fix RLS on `member_credits` to allow member reads via `member_id` subquery |
| `src/pages/admin/MemberDetail.tsx` | Extend "Book Session" dialog to support class credit bookings with session picker |
| `src/pages/member/Credits.tsx` | Add credit usage history section |
| `src/pages/admin/MemberDetail.tsx` | Add class passes to the Credits tab in admin view |

### Order of Execution

1. Database migration first (fixes the root visibility issue for members)
2. Member Credits page history section  
3. Admin Book Session extended to include class bookings
4. Admin Credits tab shows class passes

