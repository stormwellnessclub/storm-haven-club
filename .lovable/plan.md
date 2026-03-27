

# Class Waitlist — Gap Analysis & Fix Plan

## Problem
The waitlist backend is fully built (table, RLS policies, edge functions for notifications and expiration), but the **frontend never actually calls it**. Specifically:

1. **`useJoinWaitlist()` and `useWaitlistStatus()` from `src/hooks/useWaitlist.ts` are not imported or used anywhere in the app** — no component ever calls them
2. The Schedule page shows a "Join Waitlist" button label when a class is full, but clicking it opens the regular `BookingModal`, which attempts a normal booking (which will fail or show "no spots")
3. The `ClassCard` component accepts `onJoinWaitlist` and `isOnWaitlist` props, but these are never wired up by any parent

## Solution
Wire the waitlist hooks into the booking flow so users can actually join and see their waitlist status.

### 1. Update `BookingModal` to handle the waitlist flow
- Accept class full state — when `spotsRemaining <= 0`, show a "Join Waitlist" UI instead of payment options
- Import and call `useJoinWaitlist()` when the user confirms
- Import `useWaitlistStatus()` to show if the user is already on the waitlist
- Change the confirm button text to "Join Waitlist" and show the user's position after joining

### 2. Update Schedule page
- Import `useWaitlistStatus()` and pass session IDs to it
- When opening BookingModal for a full class, the modal handles it (per change above)

### 3. Verify the claim flow works
- When a user is notified (status = `notified`), the existing `useBooking.ts` code already checks for waitlist claims and marks them as `claimed` — this part looks correct
- The `notify-waitlist` and `process-expired-waitlist` edge functions are already built and functional

### Files to change
- **Edit**: `src/components/booking/BookingModal.tsx` — add waitlist join/status logic when class is full
- **Edit**: `src/pages/Schedule.tsx` — pass waitlist status data through to the modal

