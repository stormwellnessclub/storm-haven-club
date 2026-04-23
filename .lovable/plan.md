
Fix the “0 checked in today” issue by making the admin attendance counters resilient to partial query failures and aligning them with the real backend totals.

1. Audit every “today check-ins” UI source
- Review the components that display today’s attendance:
  - `src/pages/admin/Dashboard.tsx`
  - `src/pages/admin/CheckIn.tsx`
  - `src/hooks/useUnifiedAttendance.ts`
  - `src/hooks/useKioskAttendance.ts`
- Confirm which screen the user is relying on and which data source drives that number.

2. Harden the admin attendance fetch path
- Update `useUnifiedAttendance()` so one failing query does not zero out the whole attendance view.
- Replace the current all-or-nothing `Promise.all(...)` behavior with independent handling per source:
  - member `check_ins`
  - `guest_passes`
  - `class_bookings`
  - `spa_appointments`
  - “currently in” count
- Keep member check-ins visible even if guest/class/spa queries fail.

3. Harden the admin dashboard stat query
- Update `src/pages/admin/Dashboard.tsx` so the “Today’s Check-Ins / In Club Today” card does not depend on unrelated queries succeeding in the same batch.
- Split or safely guard the dashboard’s count fetches so a failure in appointments/classes does not collapse the today check-in count to 0.

4. Add explicit fallback and error visibility
- Add safe defaults plus error logging/toast behavior where appropriate.
- Ensure the UI distinguishes between:
  - true zero attendance
  - failed data load
- Prevent silent failures that currently look like a real zero.

5. Keep Chicago-time boundaries as the source of truth
- Preserve the existing `America/Chicago` day boundary logic in `src/lib/clubTime.ts`.
- Ensure every “today” attendance query uses the same start/end boundaries consistently.

6. Validate against backend reality
- Compare the UI result to the actual database count for today’s `check_ins`.
- Verify that the admin dashboard and admin check-in page both show the same non-zero total for today.
- Verify that optional categories (guest/class/spa) no longer break member attendance totals.

Technical details
- Likely root cause: the current admin attendance code batches multiple queries together in a way that can fail as a unit, leaving the UI at its default zero state even when member check-ins exist.
- Files likely to update:
  - `src/hooks/useUnifiedAttendance.ts`
  - `src/pages/admin/Dashboard.tsx`
  - possibly `src/pages/admin/CheckIn.tsx` if any empty-state behavior needs adjustment
- Expected result:
  - Today’s member check-ins show correctly
  - Zero only appears when there are truly no check-ins
  - Optional attendance sources cannot wipe out the primary count
