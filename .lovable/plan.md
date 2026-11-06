# Let staff book spa appointments before the waiver is signed

## What changes
Staff can book any spa service (massages included) for a non-member or a member who hasn't signed the waiver yet. No more red "must sign via the portal" block.

1. **Booking no longer blocked.** The staff booking window shows a gentle notice instead of an error: "Waiver not signed yet — we'll send them a link."
2. **Email or phone required when the waiver is missing.** Staff must enter at least one so the link can reach them.
3. **Confirmation carries the waiver link.** The booking email and/or text (text only if they've agreed to texts) includes the create-account-and-sign-waiver link, same as walk-in guests get today.
4. **Verbal consent checkbox.** An optional "Client verbally agreed to the waiver terms" box. When ticked, the appointment saves a note with the staff name and time (e.g. "Verbal waiver consent — taken by Sahar, Nov 6 3:05 PM"). It does not replace the signed waiver, which still appears as missing on their profile.
5. **Check-in reminder.** The appointment shows "Waiver pending" in the schedule and check-out views so the desk can have them sign on arrival.

Online self-booking stays as is (waiver still required there).

## Technical details
- `AdminSpaBookingModal.tsx`: remove the waiver throw in the booking mutation and the `waiverSigned` condition in the Book button's `disabled`; replace both alerts with one amber notice; require email or phone when `!waiverSigned`; for account customers with no waiver, still pass contact to `sendSpaNotifications` so the waiver-link version is used.
- Add verbal-consent checkbox; prepend a dated line to `staff_notes` when checked.
- Show a "Waiver pending" badge in `Appointments.tsx` / completion dialog when the client has no signed waiver.
- No database change needed (no database rule enforces the waiver on staff bookings).
- Test with a fake client and confirmations turned off, so no real messages go out.
