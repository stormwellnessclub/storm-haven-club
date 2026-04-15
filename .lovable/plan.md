
Fix the booking issue at the actual failure points, not just the symptoms.

1. Diagnose the primary spa booking bug in code
- The member booking flow is currently broken by a schema mismatch:
  - `spa_services.id` is a UUID
  - `useSpaBookAppointment` still expects `serviceId: number`
  - `SpaBookingModal` sends `serviceId: typeof service.id === "number" ? service.id : 0`
- That means normal future bookings can be inserted with an invalid `service_id` value of `0`, or fail outright depending on the live database shape.

2. Fix the booking payload to match the real schema
- Update the member booking types and insert logic to use the real `spa_services.id` type consistently.
- Remove the fallback that coerces service IDs to `0`.
- Align all non-credit spa booking code with the UUID-based spa services table already used elsewhere in the app.

3. Fix availability/conflict logic so future bookings are not blocked incorrectly
- Right now the member flow checks conflicts without a therapist or room, which can turn one existing appointment into a global block for that timeslot.
- Update the member-facing availability logic to validate against actual service availability records and only block when there is a real resource conflict.
- Reuse the same service-availability model already present in admin booking instead of treating all bookings as mutually exclusive.

4. Audit wellness/recovery compatibility
- The recovery credit RPCs still use integer-style service IDs, while the newer spa services table uses UUIDs.
- Review and normalize recovery booking paths so they remain valid after the member booking fix and do not reintroduce mixed ID behavior.

5. Verify waiver issue in the same pass
- Re-check the liability waiver entry points used from spa booking and apply flow.
- Ensure every waiver link/download path resolves through the same PDF resolver and does not rely on stale stored asset URLs.
- Keep the UI the same; only fix the delivery path.

Technical details
- Files likely involved:
  - `src/components/booking/SpaBookingModal.tsx`
  - `src/hooks/useSpaBooking.ts`
  - `src/hooks/useSpaManagement.ts`
  - possibly `src/pages/Spa.tsx`
  - waiver-related files only if a remaining inconsistent path is found
- Backend review needed:
  - confirm live `spa_appointments.service_id` type
  - confirm whether member booking should reference `spa_service_availability` / therapist-service assignments for valid future slots
- If database changes are required, I’ll add a migration instead of patching around the mismatch in the UI.

Expected result
- Members can book future spa appointments again.
- The booking modal will only show/book valid time slots.
- Bookings will use the correct service IDs instead of `0`.
- Waiver open/download behavior will be checked and aligned in the same fix pass.
