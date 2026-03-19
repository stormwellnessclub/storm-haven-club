

## Fix Kids Care Booking: Same-Day Booking, Time Pickers & UX Improvements

### Problems
1. **Can't book today** — `minDate` is set to tomorrow (`addDays(new Date(), 1)`), so today's open hours are unbookable
2. **48-hour cap too restrictive** — `maxDate` is only 2 days out; backend also rejects bookings >48 hours ahead
3. **No note about registering children first** on the bookings page
4. **Upcoming bookings not prominently surfaced** with clear guidance

### Changes

**File: `src/components/booking/KidsCareBookingModal.tsx`**
- Change `minDate` from `addDays(new Date(), 1)` → `new Date()` (allow same-day booking)
- Change `maxDate` from `addDays(new Date(), 2)` → `addDays(new Date(), 7)` (7-day window)
- Filter out past time slots when the selected date is today (don't show slots that have already passed)
- Update help text from "48 hours" to "7 days"

**File: `src/hooks/useKidsCareBooking.ts`**
- Remove the `hoursUntilBooking > 48` restriction (keep the "cannot book in the past" check)
- Change to 7-day max instead

**File: `src/pages/member/KidsCareBookings.tsx`**
- Add an info alert at the top: "Please register your child before booking. You can add a child profile from the Kids Care Service Form."
- Link to the service form page
- Ensure the "Active & Upcoming" section is clearly visible (already present, no change needed)

### Result
Parents can book same-day and up to 7 days ahead, see time pickers based on open hours, and get clear guidance to register children first.

