
Goal: make the missing Thursday spa appointment visible from the exact places you’re checking, and make checkout/tip access obvious even when therapist assignment or status data is imperfect.

What I confirmed
- Your screenshot is the main admin Appointments page on Thursday, April 9, 2026, and it is rendering 0 appointments.
- There is still a navigation/landing bug: the “Therapist Schedule” button points to `/admin/spa-management?tab=availability&view=schedule`, but `src/pages/admin/SpaManagement.tsx` ignores URL params and always opens the Services tab.
- The therapist schedule UI only shows bookings under assigned therapists or in “Unassigned Appointments”, so if the data is slightly off it can still be easy to miss.
- The completion dialog already has tip UI, but only once the appointment is surfaced and opened.
- Backend staff access for spa appointments appears intended to include front desk, so this now looks more like a data-to-UI surfacing problem than just permissions.

Implementation plan
1. Verify the exact missing appointment row
- Inspect the actual Thursday booking for Wafa in the database: status, therapist/staff assignment, member_id/user_id, amount_paid, appointment_date/time.
- Confirm whether the row exists as confirmed/completed and whether it is assigned to Teresa or is effectively unassigned.

2. Fix Spa Management deep-linking
- Update `src/pages/admin/SpaManagement.tsx` to read query params and honor:
  - `tab=availability`
  - `view=schedule`
  - optional date param for the selected day
- Make the therapist schedule open directly when launched from Appointments.

3. Make the Appointments page impossible to hide existing spa rows
- Harden `src/pages/admin/Appointments.tsx` so the selected day’s appointments are rendered from the fetched data without fragile secondary filtering.
- Add a clearer empty-state/debug hint when the day shows 0 but spa availability exists, with a direct open-in-schedule action for the same date.

4. Make Therapist Schedule surface every non-cancelled booking
- Update `src/components/admin/spa/SpaAvailabilityTab.tsx` so every non-cancelled appointment for the selected date appears in one of three places:
  - assigned therapist
  - unassigned appointments
  - a fallback “Needs attention” section for records with unusual status/assignment data
- Add stronger labels so staff can immediately identify “Complete” vs “Charge” rows.

5. Ensure checkout/tip is reachable from every surfaced row
- Keep row click + action button behavior, but make sure confirmed and unpaid completed appointments always open `SpaCompletionDialog`.
- Preserve the existing tip presets/custom tip field there.

6. If the row data is malformed, repair the booking flow at the source
- If the Thursday row has incorrect assignment/status/payment defaults, update `AdminSpaBookingModal.tsx` so future admin bookings always save values that the schedule and appointments views can reliably display.
- Only add a migration if the data issue is structural rather than a one-off bad row.

Technical details
- Files likely to update:
  - `src/pages/admin/SpaManagement.tsx`
  - `src/pages/admin/Appointments.tsx`
  - `src/components/admin/spa/SpaAvailabilityTab.tsx`
  - possibly `src/components/admin/spa/AdminSpaBookingModal.tsx`
- Likely backend follow-up:
  - inspect the actual `spa_appointments` row first
  - only use a migration if schema/RLS is still part of the problem

Why this should fix what you’re seeing
- Right now, one of the main paths intended to take you to therapist schedule does not actually land you there.
- Even when you do get into spa management, the UI still depends on the appointment being assigned/grouped just right.
- This plan fixes both the routing problem and the “hidden booking” display problem, so you can open the appointment and use the checkout dialog to add the tip.

Verification after implementation
- Open April 9 from Admin Appointments and confirm Wafa appears there.
- Use the Therapist Schedule shortcut and confirm it lands on Availability → Therapist Schedule for the same date.
- Confirm Wafa appears under Teresa, Unassigned, or Needs Attention instead of disappearing.
- Open checkout from that row and confirm tip presets/custom tip work before charging.
