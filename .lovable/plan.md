

## Fix: Credits/Passes Not Restored on Class Cancellation

### Root Cause

The admin "Cancel Class" flow in `Classes.tsx` directly sets `is_cancelled: true` on the session record but **never cancels the individual bookings or restores credits/passes**. There is already an `admin_cancel_class_session` database function that handles this correctly (cancels each booking, refunds credits, refunds passes), but it's not being called.

### Fix

**1. Update `src/pages/admin/Classes.tsx` — use the RPC instead of direct update**

Replace the `cancelSessionMutation` to call `admin_cancel_class_session` RPC instead of directly updating the session. The RPC already:
- Loops through all confirmed bookings on the session
- Restores `member_credits` (class credits)
- Restores `class_passes` (pass credits)
- Marks each booking as cancelled with reason "Class cancelled by admin"
- Sets `is_cancelled: true` on the session

This is a ~5 line change in the mutation function.

**2. No database changes needed** — the `admin_cancel_class_session` function already exists and is correct.

### What This Fixes
- Admin cancels a class from the schedule → all booked members get their class credits or passes restored automatically
- Members see "Class cancelled by admin" as the cancellation reason on their booking history

