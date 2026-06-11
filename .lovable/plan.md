I found the likely issue: the intake form is not part of the booking flow itself. It only appears after a successful massage booking as a secondary dialog, and the page-level `onIntakeRequired` fallback is currently passed in but not actually used. That means the form can be missed or fail to appear when the booking dialog/focus state changes.

Plan:

1. Make the massage intake form unavoidable after booking
- In `SpaBookingModal.tsx`, replace the current “Complete Intake Form” secondary-dialog CTA with the actual `SpaIntakeForm` embedded directly on the booking confirmation screen for massage/body services.
- After the appointment is created, the confirmation screen will immediately show the form fields below the booking details.
- The user can submit it right there without needing another popup to load.

2. Keep a clear fallback button
- Keep a visible “Complete Later” / “View My Appointments” path so booking is not blocked if someone needs to leave.
- Upcoming massage appointments will still show the existing “Intake Form” button in portal/member bookings.

3. Wire the page-level fallback correctly
- Update the intake trigger so it calls the parent `onIntakeRequired` when needed, instead of only storing local state.
- This makes the page-level intake dialog work if the booking modal closes.

4. Verify against real massage data
- Confirm massage services are marked as intake-required.
- Check that new confirmed massage appointments show an intake form prompt immediately and remain accessible from upcoming appointments if incomplete.