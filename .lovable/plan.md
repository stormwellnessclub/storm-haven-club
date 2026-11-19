# Higher Self Society: off the portal home screen, into Upcoming and Events

## What's wrong today
- The big "A Members-Only Evening · Higher Self Society · Reserve my place" card sits at the top of the portal home screen every time someone opens the portal. It also shows on the Book screen.
- That card checks a different reply list than the one the Higher Self Society reply buttons save to. You already said Yes (11 people have said Yes for December 3), but the card can't see that, so it keeps asking you to reserve.
- A second Higher Self Society box (Upcoming / Invitations) also sits on the home screen.

## What changes
1. **Portal home screen (member and non-member portals):** remove both Higher Self Society boxes. Other events that aren't Higher Self Society still get their announcement card.
2. **Book screen:** the top announcement card no longer shows Higher Self Society gatherings.
3. **My Bookings → Upcoming:** add a "Higher Self Society" group.
   - Gatherings you said Yes to show as "You're attending", with Add to calendar and a way to change your reply.
   - The next gathering you haven't answered shows once as an invitation, with Yes / Maybe / Not this time. After you answer, it moves into place and stops asking.
4. **Events calendar (the Events link in the portal menu):** Higher Self Society gatherings show your reply. If you already said Yes it reads "You're attending" instead of "Reserve my place".
5. Everywhere uses the same reply, so an RSVP made in one place shows correctly in all the others.

Nothing changes in the replies already saved, and no one is texted or emailed.

## Checks
- Signed in as you: the home screen has no Higher Self Society box. Upcoming shows December 3 as "You're attending". The Events page doesn't ask you to reserve.
- A member who hasn't replied: sees the invitation in Upcoming, answers it, and it stops asking.
- Phone and desktop.

## Technical details
- `EventAnnouncementBanner`: skip events that are Higher Self Society gatherings (the same filter `useSocietyGatherings` uses). Remove `HigherSelfSocietyCard` from `pages/member/Dashboard.tsx` and from any portal dashboard that renders it.
- Move `SocietyPortalEvents` (it reads replies from `society_meeting_rsvps` via `eventRsvp.ts`) into the upcoming section of `pages/member/Bookings.tsx` and the non-member bookings page.
- `MemberEventActions` / event detail: for Society gatherings, render `SocietyRsvp`, which reads and writes the same society reply, instead of the separate `reserve_event_seat` flow.
- Add an `AGENTS.md` rule: Society gatherings never appear on portal home screens, and reply state comes only from society RSVPs.
