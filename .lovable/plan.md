# Make the Spa Intake Form Actually Reachable

## What's broken

When a member/non-member books a massage from `/spa`, the post-booking `IntakeFormDialog` is supposed to pop up automatically. In practice the prompt is easy to miss (it can race with the booking modal closing, gets dismissed accidentally, or never appears if the booked appointment object is returned before state propagates). Either way the user has **no way to open the intake form again** afterward — there is no button anywhere in the portal/member appointment rows.

## Fix (UI-only)

Make the intake form reachable from three places, so it never gets lost:

### 1. Inline on the booking confirmation screen
In `SpaBookingModal.tsx`, when the just-booked service needs an intake (massage / body / `requires_intake_form`), show a prominent **"Complete Intake Form"** button on the existing "Booking Confirmed" screen. Clicking it opens `IntakeFormDialog` with the new `appointmentId` + `memberId`. This replaces the current "fire-and-forget" auto-popup behavior that the user keeps missing.

Also keep the auto-open behavior as a safety net via the page-level `onIntakeRequired` callback, but no longer close the modal early — let the user see the confirmation first and click through.

### 2. Inline button on `UpcomingSpaAppointmentsCard` and `SpaAppointmentRow`
For any upcoming massage/body appointment where `requires_intake_form` is true (or category/name indicates massage) **and** no intake row exists yet for that appointment, render a small **"Complete Intake Form"** button next to Cancel. Uses the existing `useIntakeFormStatuses` hook to know which ones are missing. Opens the same `IntakeFormDialog`.

### 3. Dashboard reminder
On both `src/pages/member/Dashboard.tsx` and `src/pages/portal/Dashboard.tsx`, if the user has any upcoming spa appointment that needs intake and hasn't completed it, show a single amber banner: *"Intake form needed for your upcoming [service name] on [date]"* with a "Complete Now" CTA that opens the dialog.

## Files touched

- `src/components/booking/SpaBookingModal.tsx` — add "Complete Intake Form" CTA to confirmation screen for intake-required services; stop auto-closing the modal before the user sees confirmation.
- `src/components/portal/SpaAppointmentRow.tsx` — add inline "Intake Form" button when missing.
- `src/components/portal/UpcomingSpaAppointmentsCard.tsx` — same inline button.
- `src/pages/member/Dashboard.tsx` and `src/pages/portal/Dashboard.tsx` — amber intake-needed reminder banner.
- (no DB / RLS / hook changes — `useSpaIntake`, `useIntakeFormStatuses`, and `IntakeFormDialog` already do the work.)

## Out of scope

- Changing the intake form fields themselves.
- Making intake mandatory / blocking check-in (can be a follow-up if desired).
