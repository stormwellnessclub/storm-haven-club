I found the issue in the spa edit flow: the edit modal does try to exclude the appointment being edited, but the client fallback conflict check still includes that same appointment, and the server/database conflict function may not be consistently handling edit exclusions depending on the deployed function signature. That makes an appointment conflict with itself when you change time, duration, therapist, or room.

Plan:

1. Fix appointment edits so the current appointment does not block itself
- Update the spa availability check fallback to respect `excludeAppointmentId` for both therapist and room conflict queries.
- Keep the server-side RPC exclusion in place, but make the client fallback match it so editing works even if the RPC returns no rows or falls back.
- Preserve real conflict protection: it will still block if the new time/duration overlaps a different appointment for the same therapist or room.

2. Make auto-assignment smarter during edits
- In `SpaAppointmentEditModal`, when the appointment is being edited and therapist/room are set to auto, prefer the appointment’s current therapist/room if they are still valid for the new service/date/time.
- If the current room or therapist is the only reason the slot appears blocked, the edit will be allowed because the appointment itself is excluded.
- This supports examples like moving a 10:00 appointment to 11:00 when its existing service cleanup/hold had made 11:00 look blocked.

3. Support service duration changes without false conflicts
- Ensure changing a service from 90 minutes to 60 minutes recalculates the new duration + cleanup range and only checks that new range against other appointments.
- The old appointment range will not be counted as a conflict against itself.

4. Add a clean admin removal option for cancelled spa appointments
- Add a “Remove from list” action for appointments with status `cancelled` in the admin appointments screen.
- Implement this as a hard delete only for staff/admin users via existing role-protected appointment management access, so cancelled clutter can be removed when desired.
- Add a confirmation prompt so it is not accidental.

5. Keep cancelled appointments out of day operations by default
- Adjust the main admin daily schedule counts and timeline so cancelled appointments do not keep appearing as normal scheduled items.
- If useful for audit visibility, cancelled items can remain discoverable through historical data/querying, but they will not clutter the active daily appointment list.

Technical details:
- Files to update:
  - `src/hooks/useSpaBooking.ts`
  - `src/hooks/useAdminSpaAppointments.ts`
  - `src/components/admin/spa/SpaAppointmentEditModal.tsx`
  - `src/pages/admin/Appointments.tsx`
- Database may need a small migration to normalize `check_spa_appointment_conflict(...)` so the deployed backend function always accepts `p_room_id` and `p_exclude_appointment_id`, checks `confirmed/pending/checked_in/in_progress`, and excludes the edited appointment before overlap checks.
- I will not edit the generated backend client/types files.