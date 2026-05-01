I found the reason this can still happen: the database conflict function now excludes the current appointment correctly, but the edit modal is still doing client-side pre-checks and then updating `spa_appointments` directly. That means stale auto-assignment or the old warning state can still block Save before the actual update gets a chance to happen. Also, the planned backend update RPC was not implemented yet.

Plan:

1. Add an authoritative admin edit function
- Create a backend RPC `update_spa_appointment_admin(...)`.
- It will load the appointment being edited, verify the caller is staff/admin/front desk, and run the conflict check while excluding that same appointment ID.
- It will update the appointment in one atomic operation.
- It will accept `override_conflict`; when true, it will save anyway so staff can reshuffle schedules.

2. Make the frontend use the admin edit function instead of direct table update
- Update `useUpdateSpaAppointment` to call the new RPC.
- Add an `overrideConflict` parameter to the hook input.
- Preserve the same cache invalidations and success/error toasts.

3. Stop stale conflict warnings from blocking normal edits
- In `SpaAppointmentEditModal`, remove the hard block where an old `conflict` state prevents saving.
- On normal Save, send the current form values to the RPC with `overrideConflict: false` and let the backend return the real answer.
- If the backend says there is a real conflict, show the warning and enable `Override & Save`.

4. Make auto assignment less likely to pick the blocked resource
- For edits, if therapist or room is set to Auto, resolve fresh at save time.
- Prefer the existing therapist/room only when keeping the same appointment’s resources makes sense.
- If a user manually picks another therapist/room, use that exact resource.

5. Improve the error message so it’s actionable
- If a real conflict exists, show whether it is therapist or room related and include the blocking appointment ID internally from the RPC result.
- Keep `Override & Save` visible so staff can move the first appointment even before moving other appointments.

6. Keep cancellation cleanup behavior
- Keep cancelled/no-show hidden by default from the admin day view and stats.
- Keep the permanent Remove option for cancelled/no-show rows.

Technical details:
- New migration: create `public.update_spa_appointment_admin(...)` with `SECURITY DEFINER`, `search_path = public`, and role checks using existing role functions.
- Update files:
  - `src/hooks/useAdminSpaAppointments.ts`
  - `src/components/admin/spa/SpaAppointmentEditModal.tsx`
- Do not edit generated backend client/type files.
- Existing `check_spa_appointment_conflict` will remain as the shared conflict detector; the new RPC will be the authoritative edit path.