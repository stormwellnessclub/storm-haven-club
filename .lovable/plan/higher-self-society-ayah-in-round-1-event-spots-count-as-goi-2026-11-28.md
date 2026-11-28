# Higher Self Society: Ayah in Round 1, event spots count as Going

## What the records show (checked today)
- **Aya Charafeddine** is on the Society list as a Round 1 member. She reserved her Dec 3 spot on the event page, not with the Society RSVP button. The new list shows her as "Event spot", not "Going", which is why it looked like she wasn't RSVP'd.
- **Ayah Abouarabi** has a Dec 3 spot and is an active member, but she was **never added to the Society list**. Earlier I only kept her Dec 3 spot. I didn't add her to Round 1.
- **Keziah Smith** is in the same situation as Ayah: she has a Dec 3 spot and isn't on the Society list. You chose to keep her spot and email her about the book, which was sent.

## The fix
1. **Add Ayah Abouarabi to the Society list as a Round 1 member.** She's added by staff using her own account, as an active member. No email or text goes to her.
2. **A Dec 3 event-page spot counts as Going.** Aya C., Ayah and Keziah show as Going on every page, with a small "via event page" note. Dec 3 becomes **13 going**, 1 maybe, 5 no answer, plus Susu, who closed the reminder.
3. **Keziah stays off the Round 1 member list unless you say so.** She still shows as Going for Dec 3 because she has a spot.

## Technical details
- Data: insert a `higher_self_society_interest` row for Ayah (user_id `2c4d1b25-…`, email ayahabouarabi@gmail.com, `source='staff'`, `joined_round_key` null = Round 1, `is_member=true`, `status='interested'`), using the existing staff-add RPC path or an equivalent single-row insert. No messages.
- `buildRoundAttendance`: a paid event spot with no RSVP answer becomes `status: "yes"` with `viaEvent: true`, and an RSVP answer still wins. `SocietyRsvpList` shows "Going · via event page". Remove the separate "event spots" count.
- Update `societyRoundAttendance.test.ts`: a spot holder with no RSVP counts as Going.
