# Higher Self Society: one true list for each round

## What the live records show (checked today)
- **Sarah Kawar DID RSVP "yes"** for Dec 3 on the Society page. She is on the real list.
- **Shams Al-Badry did NOT RSVP for Dec 3.** She was added by staff on Oct 20 to **Round 2** (Jan 7) only.
- The Society page's Round 1 RSVP box lists **all 21 people on the Society list**, including Round 2-only people. That's why Shams shows up there, marked "No reply". The event pages list only people who answered, plus the 3 event spots. So each page shows different names and counts.
- The list never records "Round 1" on its own. Anyone not marked Round 2 is treated as an original member.

Accurate Dec 3 picture today:
- Going (10): Amineh Ahmad, Aya Beydoun, Diala Kawar, Nadine Dabaja, Noor Jassem, Rayanne Haidar, Sahar Durant, Sarah Kawar, Savannah Alawieh, Yassmena Dabaja
- Maybe (1): Zahraa Jaber
- Closed the reminder without answering (1): Susu Berry
- Event-page spots (3): Keziah Smith, Ayah Abouarabi, Aya Charafeddine
- No answer (5): Alise James, Batoul Joseph, Elizabeth McVicar, Lilian Chahrour, Maryam Hachem

## The fix
1. **Each round shows only its own people.** Round 1 = the original members plus anyone who RSVP'd Dec 3 or has a Dec 3 spot. Round 2 = people who joined Round 2 plus anyone who RSVP'd Jan 7. Shams moves off the Round 1 list.
2. **One shared list on every page.** The Society page, the Events hub, the event detail page and the front desk all use the same list. Each person appears once as Going, Maybe, Can't make it, Event spot or No answer, so every page shows the same names and counts.
3. **Clear labels.** The page says which round each person belongs to, so someone like Noor (Dec 3 and Round 2) is understandable.
4. **Nothing is changed in anyone's records and nobody is contacted.** This only fixes how the lists are shown.

## Technical details
- New shared hook `useSocietyRoundAttendance(roundKey, eventId)` merges `higher_self_society_interest`, `society_meeting_rsvps` (by event_id) and `event_tickets` for that event, de-duplicated by user_id/lowercase email.
- Round membership: round-1 = `joined_round_key is null` OR has an RSVP/ticket for the round-1 event; round-N = `joined_round_key = key` OR has an RSVP/ticket for that event.
- `SocietyRsvpAdmin` (EventsPortalSociety) is replaced with this hook for every round tab. `SocietyRsvpList` (EventsHub, EventDetail, front desk Events) uses the same hook, so counts match.
- Regression test: someone in Round 2 only isn't on the Round 1 list, and someone who RSVP'd is always listed.
- AGENTS.md rule: Society round lists come only from the shared hook.
