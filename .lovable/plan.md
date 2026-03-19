
## Fix the actual Kids Care booking blocker

I checked both the code and the live backend data for the current user. The booking prerequisites are already satisfied:

- active Kids Care pass exists
- Kids Care agreement is signed
- service form is completed
- at least one registered child exists
- open hour slots are published for upcoming dates

So this is not a “buy the pass first” problem anymore.

## Root cause
The main issue is that the member flow currently sends parents to `/member/kids-care-bookings`, but that page only shows:

- upcoming open hours
- active/upcoming bookings
- past bookings
- request-hours form

It does **not** currently include the actual booking UI or a way to click a time slot and start a booking from that page.

The booking modal with pass/child/date/time selection exists in `src/components/booking/KidsCareBookingModal.tsx`, but it is wired into the public `/kids-care` page, not the member bookings page where the user is being directed.

## Implementation plan

### 1. Put booking access on the member bookings page
Update `src/pages/member/KidsCareBookings.tsx` to add a clear “Book a Session” action near the top and wire it to `KidsCareBookingModal`.

This will make the page where members land actually usable for booking.

### 2. Make upcoming open hours clickable
On `src/pages/member/KidsCareBookings.tsx`, turn each upcoming open-hours card into an entry point for booking:
- add a “Book this time” action for each date block or slot
- open the existing `KidsCareBookingModal`
- prefill the selected date when launched from a slot card

That directly matches the user expectation of clicking an available time/open date.

### 3. Keep the “register child first” guidance visible
Preserve and strengthen the existing note on the bookings page:
- remind parents they must register a child before booking
- keep the link to `/member/kids-care-service-form`
- clarify that bookings must be made by selecting from the registered child list

### 4. Ensure booking uses registered children only
The modal already supports saved children and requires `selectedChildId` for submission. I would tighten the UX in `src/components/booking/KidsCareBookingModal.tsx` so it behaves explicitly as:
- choose pass
- choose registered child
- choose date/time
- confirm booking

This avoids any confusion from leftover fallback child-name/age state.

### 5. Improve empty-state messaging
If there are:
- no registered children
- no passes
- no slots for a selected day

show clearer member-facing messages that explain exactly what to do next, instead of making it feel like the booking UI is broken.

## Files to update
- `src/pages/member/KidsCareBookings.tsx`
- `src/components/booking/KidsCareBookingModal.tsx`

## Expected result
After this change, a member with a purchased pass will be able to:

1. go to `Member > Kids Care Bookings`
2. see upcoming open hours
3. click into booking from that page
4. pick from their registered children
5. choose a valid start/end time
6. confirm the booking
7. then see it listed under Active & Upcoming

## Technical notes
- Backend data is already present and valid, so this looks like a frontend flow/wiring issue rather than a pass/payment issue.
- No database change is needed for this fix.
- The existing modal and booking mutation can be reused; the main work is connecting them to the member bookings page and preselecting the chosen date/slot context.
