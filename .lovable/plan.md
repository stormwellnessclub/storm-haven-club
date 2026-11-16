# PT waitlist for full time slots

## What clients will see
- In Request Session, any trainer hour that is already taken now still shows, marked **Waitlist** (greyed, with the trainer's color), instead of disappearing.
- Tapping it opens the same confirm sheet, worded "Join the waitlist" with a clear note: "This time is full. You'll be contacted if it opens up."
- Semi-Private counts as full only when it has 4 people; One-on-One, Reformer 1:1 and Mat 1:1 are full once one session or confirmed request is in that hour.
- Time off and blocks stay hidden (not waitlistable) — only hours taken by other clients show Waitlist.
- In Requests + Upcoming, waitlist entries appear in their own "Waitlisted" group, with a Leave waitlist button.

## What staff will see
- PT calendar: a small "Waitlist (n)" tag on the full session under that trainer; tapping it lists who is waiting, in place.
- The existing PT Waitlist panel in Requests shows each entry (client, trainer, day, hour, notes, package status) with Book / Contact / Close.
- When a session in that hour is cancelled, staff see the slot flagged "Opened — n waiting" so they can offer it. No automatic texts to waitlisted clients for now.

## Not changing
- Instant booking stays off; joining the waitlist never books or charges anything.
- Trainer schedules stay private — clients only see "Waitlist", never who booked.

## Technical details
- Extend `pt_client_request_times_all` to also return taken hours with `status = 'full'` (privacy-safe: no client info), using capacity per session type.
- New client RPCs `pt_waitlist_join` / `pt_waitlist_leave` writing to existing `pt_waitlist` (ownership-checked, blocked-person check, duplicate guard); add client read via safe portal RPC.
- Staff RPC for waitlist counts per trainer/hour for the calendar; reuse `PTWaitlistPanel`.
- Tests for: full detection (1:1 = 1, semi-private = 4), block hours excluded, duplicate join rejected.
