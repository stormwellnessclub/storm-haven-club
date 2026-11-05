# Make Round 2 sign-ups easy to find

## Where they are today
Admin sidebar → Events → **Higher Self Society** → the **Round 2** tab at the top. The list is a plain card mixed in with book picks and send controls, the page opens on the Members tab, and the Members tab still counts everyone together. That's why it feels scattered.

## Changes
1. **Open on the current round.** The page opens straight to the newest round (Round 2), not Members.
2. **Summary strip at the top of each round tab:** Signed up · Members · Guests · Book picks — with counts.
3. **One sign-up table** (replaces the separate list and book-pick cards): name, email, phone, member or guest, date joined, book pick + reason. Includes search, sort by date, and a "Download list" button.
4. **Send controls moved lower** into a collapsed "Messages" section so they don't push the list down.
5. **Members tab gets a "Round" column/filter** (Round 1, Round 2, both) so you can see who's in which round in one place.
6. **Sidebar shortcut:** "Round 2 sign-ups" link under Higher Self Society opens that tab directly.

## Technical details
- `EventsPortalSociety.tsx`: default `tab` to last `SOCIETY_ROUNDS` key when no `?round=`; new `SocietyRoundSignups` component built from `rows` filtered by `joined_round_key`; CSV export; wrap `SocietyLastCallControls` in a Collapsible.
- `AdminSidebar.tsx`: add link to `/events-portal/society?round=<round-2 key>`.
- No database changes.
