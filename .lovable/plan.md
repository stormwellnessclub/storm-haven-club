

## Goal
When a spa appointment is cancelled (admin or member), free up that time slot immediately so it can be re-booked.

## What's actually wrong
The booking grid hides time slots based on a cached query called `spa-booked-slots`. That query already correctly filters out `cancelled` appointments — it only includes statuses `confirmed`, `pending`, `checked_in`, `in_progress`.

The bug is that **neither cancel path invalidates that cache**:

- `useCancelSpaAppointment` (member cancel, in `src/hooks/useSpaBooking.ts`) invalidates `spa-appointments` and `admin-spa-appointments` but **not** `spa-booked-slots`.
- `useUpdateSpaAppointmentStatus` (admin cancel/status change, in `src/hooks/useAdminSpaAppointments.ts`) does the same — also missing `spa-booked-slots`.

Result: after you cancel, the database is correct, but the booking modal keeps showing the old slot as taken until the cache naturally expires (30s stale time) or the page is hard-refreshed.

For comparison, the booking mutation at line 180 of `useSpaBooking.ts` correctly invalidates all three queries — that's why new bookings show up immediately but cancellations don't free up.

## Implementation plan

### 1. Fix member cancel path
File: `src/hooks/useSpaBooking.ts` — `useCancelSpaAppointment` `onSuccess`

Add the missing invalidation so the booking grid refetches:
- invalidate `["spa-booked-slots"]` alongside the existing two invalidations.

### 2. Fix admin cancel / status-change path
File: `src/hooks/useAdminSpaAppointments.ts` — `useUpdateSpaAppointmentStatus` `onSuccess`

Same fix: add `queryClient.invalidateQueries({ queryKey: ["spa-booked-slots"] })`. This also covers admin marking an appointment as `no_show`, which should likewise free the slot (the booked-slots query already excludes `no_show`).

### 3. Verify
- Open an existing booking, cancel it from the admin Appointments page.
- Immediately open "New Spa Appointment" for the same date and service.
- The previously-blocked time should now appear as a selectable start time without a page refresh.
- Repeat from the member portal cancel flow.

## Files touched
- `src/hooks/useSpaBooking.ts`
- `src/hooks/useAdminSpaAppointments.ts`

## Expected result
Cancelling a spa appointment immediately frees the time slot in the booking grid — no refresh, no waiting for cache expiry. No database or RLS changes required; the query that controls slot blocking already excludes cancelled rows correctly.

