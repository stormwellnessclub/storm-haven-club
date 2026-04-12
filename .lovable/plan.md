
Goal: fix the spa flow so Thursday appointments reliably appear in both admin views and staff can actually complete/charge them from an obvious place.

What I found
- There is a real navigation bug: `src/pages/admin/Appointments.tsx` sends both “Therapist Schedule” and “Spa Management” to `/admin/spa`, but the actual route is `/admin/spa-management`.
- The therapist schedule currently mixes availability rows and booked appointments in the same list, so bookings are easy to miss.
- Admin bookings are inserted as `status: "confirmed"` with `amount_paid` already set to the service price in `AdminSpaBookingModal.tsx`. That means the checkout dialog can become misleading, because the appointment looks prepaid even when staff still expects to charge at completion.
- The spa completion dialog only treats `member_id` as “has card on file”. That works for members, but not for non-member / guest spa appointments that may still have stored payment details under a user profile.
- There’s a likely broader data consistency issue in the spa stack: availability uses UUID service IDs, while appointments still use numeric service IDs from the legacy hardcoded service list. That split can cause booking/schedule mismatches and needs to be reviewed carefully while implementing the fix.

Implementation plan
1. Fix the broken spa navigation
- Update `src/pages/admin/Appointments.tsx` so the quick-action buttons go to `/admin/spa-management`.
- Make the button labels clearer so staff knows where to go for bookings vs therapist schedule.

2. Make booked spa appointments impossible to miss
- Redesign the “Therapist Schedule” section in `src/components/admin/spa/SpaAvailabilityTab.tsx` so booked appointments render in a clearly separated “Booked Appointments” area for each therapist instead of blending into availability slots.
- Add an empty state that explicitly says whether the therapist has no bookings for that day versus no configured availability.
- Keep row click + Complete/Charge actions directly on the booking rows.

3. Correct admin spa booking payment behavior
- Update `src/components/admin/spa/AdminSpaBookingModal.tsx` so newly created appointments are not incorrectly treated as already paid by default.
- Store admin-created bookings in a state that matches the real workflow: booked/confirmed first, then charged/completed at checkout.
- Preserve special cases like complimentary or already-paid flows only when explicitly selected.

4. Make spa checkout support the actual saved-card source
- Update `src/components/admin/spa/SpaCompletionDialog.tsx` so “card on file” is based on actual saved payment capability, not only `member_id`.
- For member appointments, keep the existing saved-card charge flow.
- For non-member/guest spa appointments, add support for charging their stored customer record when available, instead of forcing staff into a dead end.

5. Tighten the appointments data flow
- Review and update `src/hooks/useAdminSpaAppointments.ts` so the admin appointment query returns everything the checkout dialog needs for both members and non-members.
- If needed, expand the joined data returned for spa appointments so the card-on-file decision is reliable and the UI can show who is actually chargeable.
- Keep the date filtering on local `yyyy-MM-dd` strings so Thursday stays stable.

6. Validate backend access rules if staff still can’t see data
- Re-check the existing backend access for `spa_appointments` during implementation.
- If role-based access is still inconsistent in practice, add one focused migration to align spa appointment staff visibility/management with the intended staff roles.
- No broad schema rewrite unless the data review proves it’s necessary.

Technical details
- Files to update:
  - `src/pages/admin/Appointments.tsx`
  - `src/components/admin/spa/SpaAvailabilityTab.tsx`
  - `src/components/admin/spa/AdminSpaBookingModal.tsx`
  - `src/components/admin/spa/SpaCompletionDialog.tsx`
  - `src/hooks/useAdminSpaAppointments.ts`
- Possible backend follow-up:
  - one migration only if access-rule mismatches are confirmed during implementation
- Important caution:
  - the spa system currently appears to straddle a legacy numeric service model and a newer UUID-based management model; while fixing the visible booking/checkout issues, I would also verify that appointments are being created with data the therapist schedule can consistently recognize.

Verification after implementation
- Open Thursday in `/admin/appointments` and confirm the booked spa appointments appear.
- Open `/admin/spa-management` → Therapist Schedule on the same Thursday and confirm the same bookings appear under the correct therapist.
- Click a booking from both places and confirm the completion/charge dialog opens.
- Verify card-on-file checkout works for both eligible members and eligible non-members.
- Confirm complimentary/cash/manual flows still work without breaking the appointment status.
