# Massage confirmations + intake prompts for non-members

## What happens today (verified)

Self-booked online (non-member books themselves in the portal):
- Confirmation email IS sent (`spa_appointment_confirmation`), plus SMS if they opted in. The lookup falls back to non-member profiles, so non-members are covered.
- The email does NOT mention the intake form, and its button links to `/member/bookings`, which is the member route — non-members land in the wrong place.
- The non-member portal (Dashboard + Bookings) does show an "Intake form needed before your session" prompt with a button for massage/body services, so in-app prompting works.

Booked by staff (front desk / admin spa booking modal):
- NO confirmation email or SMS is sent at all — the appointment is inserted directly with no notification.
- Walk-in bookings with no linked account get no email and no way to see the intake prompt.
- Reminder emails (2h / next day) also never mention the intake form.

## What to build

1. Confirmation email upgrade
   - Add an "Complete your intake form" section to `spa_appointment_confirmation` for massage/body services, with a button that deep-links the recipient to their bookings page where the intake dialog opens.
   - Make the button URL audience-aware: non-members go to `/portal/bookings`, members to `/member/bookings`.

2. Send confirmations on staff-booked appointments
   - After the admin/front-desk booking modal inserts an appointment with a linked user, fire the same confirmation email + SMS path used by self-booking.
   - Add a "Send confirmation email" checkbox (default on) so staff can skip it for walk-ins/comped bookings.
   - Walk-ins with no account: no email possible; show a small note in the modal so staff know.

3. Reminder email
   - Include the intake reminder line + link in the spa reminder email when the intake form is still missing for a massage/body service.

## Technical notes

- Reuse `sendSpaNotifications` from `src/hooks/useSpaBooking.ts` (export it or move to a shared helper) and call it from `src/components/admin/spa/AdminSpaBookingModal.tsx` after insert.
- Extend `send-email`'s `spa_appointment_confirmation` and `spa_appointment_reminder` cases with `needsIntake` and `bookingsUrl` data fields; the caller decides audience by checking whether a members row exists for the user.
- Intake detection matches existing logic in `SpaAppointmentRow.tsx` (category contains "massage"/"body" or name contains "massage").
- Deep link: add support for `?intake=<appointmentId>` on the bookings pages to auto-open `IntakeFormDialog`.
- No schema changes; RLS on `spa_intake_forms` already allows any signed-in user to manage their own form.
