

## Fix: Credits Not Restored on Early Class Cancellation

### Root Cause

The cancellation code in `useCancelBooking` correctly attempts to restore credits/passes when a member cancels more than 24 hours before class. However, the database security policies (RLS) on `member_credits` and `class_passes` only grant UPDATE access to staff roles -- not to regular members. This means the credit restoration update is **silently rejected** by the database every time a member cancels.

### Solution

Create a new database function `cancel_class_booking` that runs with elevated privileges (SECURITY DEFINER), handling the entire cancellation atomically:
1. Verify the booking belongs to the calling user
2. Check the 24-hour cancellation policy
3. Cancel the booking
4. Restore credits/pass if within the free cancellation window
5. Return the result (including whether credit was forfeited)

Then update `useCancelBooking` in the frontend to call this single RPC instead of doing multiple separate queries that get blocked by RLS.

### Changes

**1. Database Migration -- New `cancel_class_booking` RPC**

A SECURITY DEFINER function that:
- Takes a booking ID
- Validates the booking belongs to `auth.uid()`
- Calculates whether it's a late cancellation (less than 24 hours)
- Updates booking status to `cancelled`
- If early cancellation: restores `member_credits.credits_remaining` or `class_passes.classes_remaining`
- Returns a JSON object with success status, whether credit was forfeited, and session details for the email

**2. Update `src/hooks/useBooking.ts` -- `useCancelBooking` function**

Replace the current multi-step approach (select booking, update booking, update credits separately) with a single `supabase.rpc('cancel_class_booking', { _booking_id: bookingId })` call. The email sending and waitlist notification logic stays in the frontend as secondary actions.

### Why This Approach

- Atomic: Credit restoration and booking cancellation happen in the same database transaction, so they can't get out of sync
- Secure: The RPC validates ownership internally, so we don't need to open up UPDATE policies on credit tables to all users
- Reliable: No more silent RLS failures

