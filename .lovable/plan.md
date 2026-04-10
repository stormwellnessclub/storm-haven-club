
Goal: make spa appointments actually visible on Thursday and make checkout/charging reachable from an obvious spa workflow.

What’s most likely broken
- The Appointments page is doing unsafe date handling with date-only values. `appointment_date` is a database `DATE`, but the UI converts it with `new Date(...)` and compares `toDateString()`. That can shift appointments to the wrong day and hide Thursday bookings.
- The schedule only shows one appointment per time slot (`find(...)`), so if two therapists both have a 10:00 AM booking, one of them disappears.
- The schedule is hardcoded to fixed hours, so some valid spa bookings can fall outside the visible range.
- There is also a permissions mismatch risk: the admin UI allows front desk into spa appointments, but the backend policy for `spa_appointments` does not currently include `front_desk`.

Implementation plan
1. Fix date filtering so Thursday bookings cannot disappear
- Update `src/hooks/useAdminSpaAppointments.ts` to build the date filter with a local `yyyy-MM-dd` string instead of `toISOString()`.
- Update `src/pages/admin/Appointments.tsx` to stop re-parsing `appointment_date` with `new Date(...)`.
- Remove the extra client-side date filter or replace it with direct string comparison.

2. Fix the schedule so all same-time spa appointments appear
- Replace `getAppointmentForSlot()` / single `find(...)` logic in `src/pages/admin/Appointments.tsx`.
- Group appointments by time and render every appointment in that slot, not just the first one.
- Keep each appointment card independently clickable for checkout.

3. Make the daily timeline match real spa hours
- Generate the visible time range dynamically from booked appointments and/or spa availability instead of the current fixed 8 AM–6 PM list.
- Ensure evening appointments still show.

4. Keep checkout/charging obvious and reusable
- Continue using `SpaCompletionDialog` from both the main Appointments page and the Therapist Schedule.
- Preserve row click + explicit action buttons for confirmed and completed-but-unpaid bookings.

5. Add a clearer spa admin entry point
- Add obvious quick actions/links at the top of the Appointments screen to:
  - Book Spa Appointment
  - Open Therapist Schedule / Spa Management
- This avoids hunting through the sidebar when you need to book or check someone out fast.

6. Align backend access with the UI
- Review the `spa_appointments` RLS policy and, if needed, add `front_desk` to the staff access rule so anyone allowed into the screen can actually read/manage the bookings.
- Keep access staff-only; do not expose spa appointments publicly.

Files likely updated
- `src/hooks/useAdminSpaAppointments.ts`
- `src/pages/admin/Appointments.tsx`
- `src/components/admin/spa/SpaAvailabilityTab.tsx`
- one backend migration for spa appointment access rules if the role mismatch is confirmed

Verification after implementation
- Go to Thursday and confirm all spa bookings are visible.
- Confirm two appointments at the same time both render.
- Confirm clicking a booking opens checkout.
- Confirm charging/completing updates the appointment immediately.
- Confirm the flow works for the staff roles that are supposed to use it.
