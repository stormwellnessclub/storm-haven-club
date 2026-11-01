# Book Club: "Currently Reading", member portal, and RSVPs

## 1. Book club page
- **Top section:** "Currently Reading" shows *The 48 Laws of Power* by Robert Greene, with the cover, a short synopsis and the first gathering: Thursday, December 3, 7:00–9:00 PM.
- **RSVP:** signed-in book club members see "Will you be joining us?" with Yes, Maybe and Can't make it buttons. They can change their answer anytime.
- **Next round:** a "Join the next round" section with the sign-up form and book suggestions.
  - Voting closes Sunday, November 15.
  - The book is chosen by the end of November.
  - The meeting is Thursday, January 7.
- **First round results:** the closed vote list moves lower on the page and gets smaller.

## 2. Member portal
- **Book club members:** their book club card shows:
  - "Currently Reading: The 48 Laws of Power" with the cover.
  - The December 3 gathering.
  - Their RSVP, with buttons right on the card.
- **Members not in the book club:** they see "Join the next round."

## 3. Admin: everything on the book club's own page
All book club controls stay on the one Higher Self Society page in the events area. No new admin pages. That page gets simple tabs, one per round:

```text
Higher Self Society
  [ Members ]  [ Round 1: The 48 Laws of Power ]  [ Round 2: January ]
```

- **Members:** the sign-up roster, guest approvals, adding a person and the invitation email, as they are today.
- **Round 1: The 48 Laws of Power (Dec 3):**
  - The vote results.
  - RSVPs: Yes, Maybe, Can't make it and No reply counts, the names with each person's answer, and a spreadsheet download.
  - The winning book announcement, plus a new RSVP reminder that only goes to people who haven't replied.
  - The old vote announcement and vote reminder panels move here.
- **Round 2 (Jan 7):**
  - Book suggestions collected from sign-ups.
  - The next-round email to members.
  - Later, the ballot and vote results once you send the book list.
- **Calendar:** the December 3 and January 7 meetings are added to the events calendar. Clicking one opens this same book club page on that round's tab, so there's never a second place to manage it.

## 4. Winning book email and text
- The button becomes "RSVP for December 3" and takes people straight to the RSVP spot.
- Both messages mention RSVPs.

## Rules
- Only people on the book club list can RSVP.
- Each person has one answer per meeting, and it can be changed.
- Staff see all RSVPs. Members only see their own.
- All sends follow the existing rules: a test send first, unsubscribed people skipped, texts only to people who agreed to them, and each person gets it once.

## Technical details
- A new meeting RSVP table, keyed by round, with one answer per person per round. Members can add or change only their own answer, and staff can read all answers.
- The rounds (book, meeting date, vote dates) live in the book club settings file, so adding a round adds a tab.
- The page and portal card share one RSVP control.
- The book club sending function gets an RSVP reminder message type and the updated winner button and link.
- Calendar entries for the meetings link to the book club page with the round tab preselected.
