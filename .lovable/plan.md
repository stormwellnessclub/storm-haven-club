

## Auto-Restore Credits When Admin Cancels a Class

### Problem
When an admin cancels a class from the Class Management page, the session is marked as cancelled but all booked members lose their credits/passes with no refund. This needs to happen automatically.

### Solution
Create a new database function `admin_cancel_class_session` that atomically:
1. Marks the session as cancelled (with visibility mode and reason)
2. Finds all confirmed bookings for that session
3. For each booking paid with credits: restores `member_credits.credits_remaining`
4. For each booking paid with a pass: restores `class_passes.classes_remaining` and reactivates the pass
5. Marks all bookings as `cancelled`
6. Returns a summary (how many bookings refunded)

Then update the frontend to call this RPC instead of doing a raw update.

### Changes

**1. Database Migration -- `admin_cancel_class_session` RPC**

A `SECURITY DEFINER` function that:
- Takes `_session_id UUID`, `_is_hidden BOOLEAN`, `_cancellation_reason TEXT`
- Validates the caller is admin/manager/super_admin
- Loops through all confirmed bookings on that session
- Restores credits or pass uses for each booking
- Cancels all bookings
- Sets `is_cancelled = true` (and `is_hidden` per the mode) on the session
- Returns a JSON summary with the count of refunded bookings

**2. Update `SoftLaunchClassManagement.tsx` -- `cancelSessionMutation`**

Replace the current direct `class_sessions` update with a single `supabase.rpc('admin_cancel_class_session', ...)` call. The RPC handles everything server-side, so credits are guaranteed to be restored even if the frontend loses connection mid-operation.

### Technical Details

The RPC will contain logic like:

```text
FOR _booking IN
  SELECT id, payment_method, member_credit_id, credits_used, pass_id
  FROM class_bookings
  WHERE session_id = _session_id AND status = 'confirmed'
LOOP
  -- Restore credit
  IF _booking.payment_method = 'credits' AND _booking.member_credit_id IS NOT NULL THEN
    UPDATE member_credits
    SET credits_remaining = credits_remaining + COALESCE(_booking.credits_used, 1)
    WHERE id = _booking.member_credit_id;
  END IF;

  -- Restore pass
  IF _booking.payment_method = 'pass' AND _booking.pass_id IS NOT NULL THEN
    UPDATE class_passes
    SET classes_remaining = classes_remaining + 1, status = 'active'
    WHERE id = _booking.pass_id;
  END IF;

  -- Cancel the booking
  UPDATE class_bookings SET status = 'cancelled' WHERE id = _booking.id;
END LOOP;
```

The frontend mutation becomes a single RPC call, and the success toast will report how many members had their credits restored.

