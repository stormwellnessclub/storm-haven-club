# Let staff book spa appointments without a waiver or card

## What changes
Staff can book any spa service (massages included) for walk-ins or phone callers, members or non-members, even when they have no signed waiver and no card on file.

1. **Booking no longer blocked.** The red "must sign via the portal" message goes away. Staff see a short notice instead: "Waiver and intake not done yet — we'll send them a link."
2. **No card needed.** The missing-card note stays as a reminder only (it doesn't block today); staff take payment at the desk.
3. **Email or phone required.** When the waiver is missing, staff must enter at least one so the link can reach the client.
4. **One link, no loopholes.** The confirmation goes by email if we have one, and by text if we only have a phone (or both). The link opens one page that:
   - shows their appointment,
   - creates their account with name, email and phone already filled in from the booking,
   - goes straight into the intake form for that appointment, then the waiver,
   - saves progress, so closing the page and coming back doesn't lose what they entered.
5. **Text without prior opt-in.** A booking text is a one-time confirmation the client asked for by phone or in person. Staff tick "Client agreed to receive a text" before it sends, and we record that agreement.
6. **Verbal waiver note.** Optional "Client verbally agreed to the waiver terms" box. It saves a note with staff name and time. Their profile still shows the signed waiver as missing until they sign.
7. **Reminder at arrival.** The schedule and check-out views show "Waiver pending" / "Intake pending" so the desk can finish it on arrival.
8. **Resend link.** A "Resend link" button on the appointment for anyone who didn't get or lost it.

Online self-booking stays as is.

## Technical details
- `AdminSpaBookingModal.tsx`: remove the waiver throw in the booking mutation and the `waiverSigned` term in the Book button's `disabled`; merge the two alerts into one amber notice; require email or phone when `!waiverSigned`; pass contact to `sendSpaNotifications` for account customers missing a waiver too.
- Booking link: a signed per-appointment token page (reuse the existing guest create-account-and-waiver link) that prefills signup, auto-links the appointment via the existing guest_email trigger (and a phone match for phone-only guests), then routes to the correct intake by `intakeKindFor()` and the waiver. Intake drafts autosave per appointment.
- SMS goes through `send-sms`; staff-confirmed consent is recorded in `phone_sms_consent` with source "staff_booking"; an account opt-out still wins.
- Verbal consent line prepended to `staff_notes`. "Waiver/Intake pending" badges in `Appointments.tsx` and the completion dialog. Resend button reuses `sendSpaNotifications`.
- Test with a fake client and sends disabled; no real messages or charges.
