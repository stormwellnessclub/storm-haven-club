## Goal

After a successful spa/wellness booking, replace the current toast-only feedback with an in-modal confirmation screen that clearly shows the booking details and a link to view all appointments.

## What it shows

A success view rendered inside `SpaBookingModal` (replacing the booking form once a booking succeeds), containing:

- Large green check icon + "Booking Confirmed" heading
- **Service name** (e.g. "Red Light Therapy")
- **Date & time** formatted as `EEEE, MMMM d, yyyy · h:mm a` (Chicago time)
- **Duration** (e.g. "20 min")
- **Payment summary** — one of:
  - `Paid with 1 Red Light Therapy Credit · X remaining` (when credits were used)
  - `Charged $XX.XX to card ending •••• 4242` (when card was charged)
  - `Charged to Member Account` (when applicable)
- Two actions:
  - Primary: **View My Appointments** → navigates to `/member/wellness` for members, `/portal/bookings` for non-members, then closes the modal
  - Secondary: **Done** → just closes the modal

If the service requires an intake form, the existing intake dialog flow stays exactly as it is (intake takes precedence over the confirmation screen).

## Implementation

All changes in `src/components/booking/SpaBookingModal.tsx`:

1. Add a `confirmation` state object holding the data captured at booking time:
   ```
   { serviceName, date, time, durationMinutes, paymentSummary, creditsRemaining? }
   ```
2. In `handleBook`, on success of either the credit RPC or the card path (and when no intake form is required), set `confirmation` instead of immediately calling `onOpenChange(false)`. Build the `paymentSummary` from the path that was taken:
   - credit → `"1 {creditTypeDisplayName} Credit · {credits_remaining} remaining"`
   - card → `"$X.XX charged to {brand} •••• {last4}"` using the selected `savedPaymentMethods` entry
   - member_account → `"Charged to your member account"`
3. While `confirmation` is set, render a new `<BookingConfirmationView />` block inside the existing `DialogContent`, replacing the form sections. Keep `DialogTitle` ("Booking Confirmed") for accessibility.
4. Reset `confirmation`, `selectedDate`, `selectedTime`, `memberNotes` when the modal closes (existing `useEffect` on `open`).
5. The "View My Appointments" button uses `useUserMembership` (already imported) to decide the destination: members → `/member/wellness`; everyone else → `/portal/bookings`.

## Out of scope

- No new route or dedicated detail page — the existing wellness/bookings lists already render the booking with date, time, service, and status.
- No DB or RPC changes.
- Admin booking modal unchanged.

## Files to change

- `src/components/booking/SpaBookingModal.tsx` — add confirmation state, success view, and post-book navigation.