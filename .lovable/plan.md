

## Fix: Overbooking Prevention and Waitlist Integration

### Problems Found

**1. Enrollment count mismatch (the "9 vs 8" issue)**
The `current_enrollment` counter on several sessions is inflated -- showing higher numbers than the actual confirmed bookings. For example, one session shows `current_enrollment = 4` but only has 2 confirmed bookings. This means the displayed "spots left" count is wrong. The counter gets out of sync when bookings are cancelled (especially admin cancellations or the recent RPC changes).

**2. No full-class protection on the soft-launch schedule**
The `TempClassCard` component has NO check for whether a class is full. It always shows "Book Class" regardless of enrollment. A member can click "Book" on a class at capacity. The only safety net is the database `create_atomic_class_booking` RPC which checks capacity -- but by then the UX is confusing.

**3. "Join Waitlist" button is disabled/non-functional**
In `ClassCard.tsx` (the regular schedule), when a class is full, it shows a "Join Waitlist" button but it's `disabled={isFull}`, so it literally can't be clicked. The `class_waitlist` table exists and the email notification system is built, but there's no UI flow to actually join the waitlist.

### Solution

**Step 1: Fix enrollment counter sync (Database Migration)**

Create a one-time data fix migration that recalculates `current_enrollment` for ALL sessions based on actual confirmed bookings. This corrects the existing drift.

```
UPDATE class_sessions cs
SET current_enrollment = (
  SELECT COUNT(*) FROM class_bookings cb 
  WHERE cb.session_id = cs.id AND cb.status = 'confirmed'
);
```

**Step 2: Add full-class handling to the soft-launch schedule**

Update `TempClassCard` to:
- Show "Class Full" when `enrolled >= maxCapacity`
- Disable the "Book Class" button when full
- Show a "Join Waitlist" button instead (if user is eligible)

**Step 3: Build the waitlist join flow**

Create a `useJoinWaitlist` hook that:
- Inserts into `class_waitlist` with the user's ID, session ID, and position
- Shows a success toast: "You've been added to the waitlist"
- The existing `notify-waitlist` edge function and `process-expired-waitlist` function already handle the notification side

Wire this into both `TempClassCard` (soft-launch) and `ClassCard` (regular schedule) so the "Join Waitlist" button actually works.

**Step 4: Prevent double-waitlist entries**

Add a check before inserting: if the user already has a `waiting` or `notified` entry for that session, show "On Waitlist" instead of "Join Waitlist".

### Files Changed

| File | Change |
|------|--------|
| Database migration | Sync `current_enrollment` to actual confirmed bookings |
| `src/hooks/useWaitlist.ts` | New hook: `useJoinWaitlist` and `useIsOnWaitlist` |
| `src/components/booking/TempClassSchedule.tsx` | Add full-class detection, show "Join Waitlist" or "On Waitlist" |
| `src/components/booking/ClassCard.tsx` | Enable and wire the existing "Join Waitlist" button |
| `src/hooks/useTempClassBooking.ts` | No changes needed -- the RPC already blocks overbooking |

### What Already Works (No Changes Needed)

- The `create_atomic_class_booking` RPC already locks the session row and checks capacity before inserting -- this is the true overbooking guard
- The `notify-waitlist` edge function already emails the next waitlisted person when a spot opens
- The `cancel_class_booking` RPC already calls `notify-waitlist` after cancellation
- The `class_waitlist` table schema is already in place with position, status, and claim expiry fields

