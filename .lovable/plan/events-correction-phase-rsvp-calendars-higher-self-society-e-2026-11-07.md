# Events correction phase — RSVP, calendars, Higher Self Society, email images

No new Nov–Jan events, no redesign, no Events Finance changes, no emails sent.

## What the records show today
- 11 society replies exist (10 Yes, 1 Maybe), all saved only against a "round-1" label — not against a dated gathering.
- There are **no future gatherings in the events calendar at all**, so the Events page and Ritual Calendar are empty, and "Your Upcoming" (which only reads event bookings) can never show a society Yes.
- The Dec 3 / Jan 7 dates are typed into page code, not stored as events.
- Root cause of the repeating "Are You Coming?" invitation is not yet confirmed; step 1 traces it (likely it checks a different record than the one the Yes saves to).

## Steps
1. **Trace and confirm** the invitation's show/hide check and record the exact cause.
2. **One record per gathering:** create Dec 3, 2026 (The 48 Laws of Power) and Jan 7, 2027 (book TBD), 7–9 PM Detroit, members only, as real events in the Higher Self Society series.
3. **One reply per member per gathering:** replies point to that gathering with a unique member+gathering rule; changes update the same row. Add a "dismissed" state.
4. **Repair data:** attach the 11 existing replies to the Dec 3 gathering without changing anyone's answer; keep a private repair log (record, before, after).
5. **Member portal sections:** Upcoming (Yes/booked), Considering (Maybe), Invitations (unanswered, non-blocking card), Waitlists, Past — each card with status, manage, add-to-calendar, details. Remove the sign-in popup; No and dismissed never reappear. Confirmation email only on first answer.
6. **Calendars:** Events page and Ritual Calendar read published future gatherings; empty message only when truly empty. Member-only cards stay visible to the public with a locked action. Button logic per your brief (RSVP / View RSVP / Update response / Join waitlist / View membership access / Sign in to RSVP / Reserve / View recap).
7. **Society page order:** Hero → Current Round (December Gathering) → Next Round (compact) → About → Past Rounds (collapsed) → "How the First Book Was Chosen" (collapsed). Round order driven by round states (draft → … → archived) and dates, so the call to action updates itself. Same look.
8. **Email images:** remove the shared global image; each event gets card, hero, email and mobile image + alt text; fallback order event email → event hero → series image → logo-only. Invitations use a large image; confirmations use a thumbnail or logo-only. Editor gets image pick/upload, crop, desktop/mobile preview, remove, and "fallback in use" note. Series fallbacks only from your existing photos.
9. **Admin attendee list** reads the same reply records.
10. **Tests** with test accounts only (no real sends): the 18-step sequence in your brief, plus automated checks for the reply rule, section placement and Detroit times; desktop and mobile screenshots.
11. **Final report** in the format you listed.

## Technical details
- Extend `events` (series key, round state, image fields) rather than a new system; add `event_id` + `dismissed` to `society_meeting_rsvps`, unique `(event_id, user_id)`, backfill round-1 → Dec 3 event id.
- `SOCIETY_ROUNDS` becomes a read of event rows; `SocietyRsvp`, `HigherSelfSocietyCard`, `UpcomingRitualsSection`, `PortalUpcomingEvents`, calendars all read the same occurrence.
- Email render takes the image chain; invitation vs transactional layouts in the shared renderer.
- Open question for review: series fallback images for collections with no approved photo will use logo-only until you pick one.
