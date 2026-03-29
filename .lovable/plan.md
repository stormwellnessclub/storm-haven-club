

# Show Waitlist Count + Clarify Waitlist Payment Flow

## How waitlist payment currently works (no code changes needed)

- **Joining the waitlist does NOT charge anything** — no credits deducted, no pass consumed
- When a spot opens, the system notifies the next person via email
- That person must then **book the class normally** through the booking modal, choosing credits or a pass at that point
- If they don't claim within the expiration window, the spot goes to the next person
- So the "waitlisted people with credits" you see still have those credits — they haven't been charged yet

## Code changes: Show waitlist count

### 1. Add a waitlist count query
Create a hook or extend `useClassSessions` to fetch the count of active waitlist entries per session. A simple approach: query `class_waitlist` grouped by `session_id` where `status` in (`waiting`, `notified`), returning a `Record<session_id, count>`.

### 2. Schedule page — show "(X waitlisted)" next to "Full"
In `src/pages/Schedule.tsx`, where it currently shows `"Full"` (line 299), append the waitlist count: e.g., **"Full · 3 waitlisted"**. No names shown — just the number.

### 3. ClassCard component — show waitlist count
In `src/components/booking/ClassCard.tsx`, where it shows `"Full"` (line 97), similarly show the count.

### 4. BookingModal — show waitlist count when class is full
In `src/components/booking/BookingModal.tsx`, the "Class is Full" alert can show "X people on waitlist" to set expectations.

### Files to change
- **Create/extend**: Hook to fetch waitlist counts per session (can be added to `useWaitlist.ts`)
- **Edit**: `src/pages/Schedule.tsx` — show count next to "Full"
- **Edit**: `src/components/booking/ClassCard.tsx` — show count next to "Full"
- **Edit**: `src/components/booking/BookingModal.tsx` — show count in the full-class alert

