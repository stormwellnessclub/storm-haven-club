# Fix: Semi-Private PT Booking Only Allows One Person

## What's happening

Semi-private is supposed to hold a small group, but the booking check treats any overlapping appointment for the same trainer (or room) as a hard conflict. So the first client books fine, and the second person at that same time is rejected as "trainer already booked" — the only way through today is the "book anyway" force override.

The capacity is already defined in the system: the Semi-Private Training service is set to 3 people per session. That number is simply never consulted when booking.

## The fix

1. **Respect capacity in the conflict check.** When the new booking and the existing overlapping bookings are all the same semi-private slot (same trainer, same start time, same duration, same format), treat them as one group session and only flag a conflict once the group is full. Anything else — a 1:1 overlapping a semi-private, a different start time, a different format — still conflicts as it does now.
2. **Show the group on the booking dialog.** When Semi-Private is selected with a trainer, date, and time chosen, display "2 of 3 booked" with the names already in that slot, so staff can see the group filling up.
3. **Book several people into one slot without re-opening the dialog.** Allow adding more than one client to a semi-private booking; each person gets their own appointment record (their own package deduction or unpaid charge), all sharing the same trainer/time/duration.
4. **Clear message when full.** If the group is at capacity, say "Semi-private session is full (3 of 3)" instead of the generic trainer-conflict wording, with the force override still available for a deliberate exception.

## Technical details

- Update `pt_check_appointment_conflict` to accept the incoming format and, for `semi_private`, exclude overlapping appointments that belong to the same group slot until the count reaches the capacity from `pt_session_types` for that format (currently 3). Non-semi-private behavior is unchanged.
- `book_pt_appointment` passes the format into the conflict check; the group count is evaluated inside the transaction so two simultaneous bookings can't exceed capacity.
- `BookPTSessionDialog.tsx`: multi-client selection when format is `semi_private`, a slot occupancy query for the chosen trainer/date/time, per-client payment mode (package vs bill later), and a loop that books each attendee, reporting per-person success/failure.

## Question to confirm during build

The Semi-Private service is currently configured for **3** people. Your public page describes groups of 3–4. If you want 4, that is a one-field change to the service capacity — tell me and I'll set it.
