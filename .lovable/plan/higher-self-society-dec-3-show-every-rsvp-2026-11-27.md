# Higher Self Society Dec 3 — show every RSVP

## What's happening
The RSVPs aren't lost. There are 10 "Yes" and 1 "Maybe" saved for the Dec 3 gathering. One person also dismissed the invitation on Nov 24.

The "3" you see comes from a different list: the 3 paid tickets on that event. The event pages count only tickets. Members who RSVP through the Society page are stored in a separate list, and those pages never read it. The Higher Self Society page → Round 1 tab already shows the full list.

## Changes
1. On the event pages (Events hub, event detail, front desk events, events portal calendar), Society gatherings count and list society RSVPs together with tickets, with no person counted twice:
   - Going = "Yes" RSVPs plus paid tickets
   - Maybe shown separately
2. The event detail guest list shows each RSVP person's name, email, phone and response, next to the ticket holders, so front desk can check them in.
3. A link from the event to the Higher Self Society Round tab.

## Technical details
- RSVPs: `society_meeting_rsvps` (event_id, user_id, response); tickets: `event_tickets`.
- Add one shared helper (e.g. `useEventAttendance`) that merges both sources by user_id. Use it in `admin/EventsHub.tsx`, `admin/EventDetail.tsx`, `frontdesk/Events.tsx` and `useEventsPortal.ts`.
- Read profile names through existing staff-readable access; check RLS allows staff to read `society_meeting_rsvps` for all users (the Society admin tab already does this).
- No data changes and no messages sent.
