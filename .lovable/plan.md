I checked the current code and backend function. The backend RPC now excludes the appointment correctly, but the edit modal can still reintroduce the same failure in the UI because it relies on cached auto-assignment state and the existing start time / cleanup window. I’ll tighten the edit path so edits are treated differently from new bookings and the current appointment can never be counted as its own blocker.

Plan:

1. Make edit saves compute therapist/room fresh every time
- In `SpaAppointmentEditModal`, replace the save-time reliance on `resolvedTherapistId` / `resolvedRoomId` state with a fresh resolver based on the current form values.
- If therapist/room are set to `auto`, prefer the appointment’s current therapist and room first, then fall back to the matching availability window.
- This prevents stale “auto-assigned” state from saving/checking against the wrong resource after changing service, date, duration, or time.

2. Prevent the current appointment from appearing as a conflict in every path
- Add a defensive client-side filter after `useCheckSpaAvailability` returns results: if the only returned conflict ID is the appointment being edited, treat it as available.
- Keep real conflicts blocked if a different appointment overlaps the new time/duration/resource.
- Improve conflict messages to include whether the blocking appointment is another booking, not just “therapist is booked.”

3. Make time changes re-check immediately and reliably
- Re-run the edit conflict check when `appointmentTime` changes, not only on blur and some field changes.
- Clear old conflict messages when the user changes service, date, time, therapist, or room so a previous false conflict cannot keep the Save button disabled.

4. Add an admin override path for legitimate schedule reshuffling
- Add a clearly labeled “Save anyway / Override conflict” option in the edit modal for admin/staff users when a conflict is detected.
- This will allow your real workflow: move one client, then move the other clients afterward, instead of being trapped by the first blocked edit.
- It will still show the conflict warning before override so accidental double-booking is visible.

5. Use a backend edit RPC to avoid race conditions and RLS/update inconsistencies
- Add a `update_spa_appointment_admin(...)` backend function that performs the appointment update in one place.
- It will accept the appointment ID, new service/time/duration/staff/room/notes, and an `override_conflict` flag.
- By default it runs the same conflict check excluding the appointment itself; with override enabled it updates anyway.
- It will be restricted to existing staff/admin/front desk roles.

6. Clean up cancelled/no-show visibility completely
- Keep cancelled/no-show hidden by default in the schedule timeline.
- Make the daily total reflect active appointments, with cancelled shown separately, so hidden cancelled appointments do not make the day look booked.
- Keep the “Show cancelled” toggle and remove button for cleanup.

Technical details:
- Update:
  - `src/components/admin/spa/SpaAppointmentEditModal.tsx`
  - `src/hooks/useAdminSpaAppointments.ts`
  - `src/pages/admin/Appointments.tsx`
  - likely a new database migration for the admin update RPC
- Do not edit generated backend client/type files.
- Preserve the existing conflict rules for normal new bookings; the override applies only to admin appointment edits.