

## Fix: Spa Appointments Not Visible After Booking

**Root cause**: Appointments booked by admin set `user_id: null` (only `member_id` is populated). But the member-facing query AND the RLS SELECT policy both filter by `user_id = auth.uid()`. So admin-booked appointments are invisible to the member they belong to.

Even member-self-booked appointments work by coincidence only — if any code path skips `user_id`, the appointment vanishes.

### Changes

**1. Update RLS SELECT policy for members**

Replace the "Users can view their own spa appointments" policy so it matches on EITHER `user_id` OR `member_id` (via a subquery on the `members` table):

```sql
DROP POLICY "Users can view their own spa appointments" ON spa_appointments;
CREATE POLICY "Users can view their own spa appointments"
  ON spa_appointments FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );
```

Similarly update the UPDATE policy so members can cancel/modify their own admin-booked appointments.

**2. Update RLS INSERT policy**

The current INSERT policy requires `auth.uid() = user_id`. Keep this, but also ensure admin-booked rows (with null `user_id`) are covered by the existing staff policy.

**3. Fix admin booking to populate `user_id`**

Update `AdminSpaBookingModal.tsx` line 190 to look up the member's `user_id` and set it on insert instead of hardcoding `null`. This prevents the mismatch going forward.

**4. Update member-facing query to also match by `member_id`**

Update `useMySpaAppointments` in `useSpaBooking.ts` to query with an OR condition: fetch appointments where `user_id = currentUser` OR where `member_id` matches the current user's member record. This ensures both admin-booked and self-booked appointments appear.

**5. Backfill existing orphaned appointments**

Run a migration to populate `user_id` on existing `spa_appointments` rows where `user_id IS NULL` but `member_id` maps to a known `members.user_id`.

```sql
UPDATE spa_appointments sa
SET user_id = m.user_id
FROM members m
WHERE sa.member_id = m.id
  AND sa.user_id IS NULL
  AND m.user_id IS NOT NULL;
```

### Files to change
- Database migration (RLS policies + backfill)
- `src/hooks/useSpaBooking.ts` — `useMySpaAppointments` query logic
- `src/components/admin/spa/AdminSpaBookingModal.tsx` — populate `user_id` on admin inserts

### Expected result
- All spa appointments (admin-booked or self-booked) appear in the member's wellness view
- Admin appointments grid continues working unchanged
- No security regression — members can only see their own appointments

