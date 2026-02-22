

## Urgent Fix: Stale Enrollment Counters + Nahla's Name

### What's Wrong

**Two separate issues:**

1. **Nahla's name not showing**: The profile lookup fix from the last edit is correctly implemented in the code. Her name (`Nahla Hammoud`) exists in the `profiles` table and the fallback logic will now display it. This should already be working with the deployed code.

2. **Enrollment counters are wrong (the real bug)**:
   - **Feb 27, 8 PM**: Shows 1/8 enrolled, but the only booking (Rayann Haidar) was **cancelled**. The counter should be 0.
   - **Feb 28, 9 PM**: Shows 2/8 enrolled, but only 1 confirmed booking exists (Nahla Hammoud). The counter should be 1.
   - The `update_session_enrollment` trigger exists and is enabled, but these counters drifted -- likely from a booking cancellation that didn't fire the trigger correctly (e.g., a direct status update or race condition).

### Fix

| Step | What |
|------|------|
| 1. SQL migration | Run a one-time counter correction: set `current_enrollment` to the actual count of confirmed/completed bookings for all soft-launch sessions. |
| 2. Code change | Add a recount function that admins can trigger from the roster dialog, and also auto-correct on roster load -- compare `current_enrollment` with the actual booking count and fix silently if they differ. |

### SQL Migration

```sql
UPDATE class_sessions cs
SET current_enrollment = (
  SELECT COUNT(*)
  FROM class_bookings cb
  WHERE cb.session_id = cs.id
  AND cb.status IN ('confirmed', 'completed')
)
WHERE cs.session_date >= '2026-02-20'
AND cs.session_date <= '2026-03-18';
```

### Code Change

| File | Change |
|------|--------|
| `src/components/admin/ClassRosterDialog.tsx` | After fetching bookings, compare `bookings.length` with `selectedSlot.enrolled`. If they differ, silently update `current_enrollment` in `class_sessions` to the correct count and invalidate the query cache. |

This prevents future drift from accumulating -- every time an admin opens a roster, the count self-heals.

