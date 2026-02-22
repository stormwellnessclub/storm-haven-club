

## Fix: Update Cancellation Policy from 12 Hours to 24 Hours

The cancellation window is currently 12 hours across the codebase. Updating it to 24 hours in all locations, and confirming that credits/passes are restored and the member is removed from the class list when cancelled within policy.

### Changes

| File | What |
|------|------|
| `src/hooks/useBooking.ts` | Change `hoursUntilClass < 12` to `hoursUntilClass < 24`. Update the two comment references and the toast message from "12 hours" to "24 hours". |
| `src/pages/member/Bookings.tsx` | Update the cancel dialog description from "less than 12 hours" to "less than 24 hours". |
| `src/components/booking/BookingModal.tsx` | Update the policy notice from "12 hours" to "24 hours". |

### Data Fix: Restore Rayann's Pass

Run an update to restore her consumed single-class pass:

```sql
UPDATE class_passes
SET classes_remaining = 1, status = 'active'
WHERE id = 'da2e2e91-ec29-4a21-9319-dbe88b2e9c9b';
```

### What Already Works

- Cancelling a booking sets status to `cancelled` (removes from roster/class list).
- The `update_session_enrollment` trigger decrements `current_enrollment` when status changes from `confirmed`.
- Credits (`member_credits`) and passes (`class_passes`) are restored when cancelled within the allowed window.
- The auto-heal logic in `ClassRosterDialog.tsx` corrects any counter drift on roster open.

No structural or schema changes needed -- just the threshold value and user-facing text updates, plus the one-time data correction for Rayann's pass.

