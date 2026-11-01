# Book Club: winning book, first meeting, next round

## 1. Add Yassmena's vote
- Record Yassmena Dabaja's vote for *The 48 Laws of Power*.
- Right now *48 Laws of Power* and *The Mountain Is You* are tied at 4 votes each. Her vote makes *48 Laws of Power* the winner, 5 to 4.
- **Note:** her sign-up is marked "interested," not approved, so the voting page didn't let her vote. I'll add the vote and also approve her, so she's on the roster and gets the club emails.

## 2. Winner announcement (book club roster, email and text)
- **Email subject:** "Our first book: The 48 Laws of Power"
- **Email body:**
  - Thank everyone for voting and reveal the winning book, with its cover.
  - Announce the first meeting on Thursday, December 3, at 7:00 PM, so there's time to get the book and read it.
  - Say we'll be in touch before the meeting with discussion points.
  - Say the next round is open: share book suggestions now, the ballot is coming soon, voting closes Sunday, November 15, the book is chosen by the end of November, and that meeting is Thursday, January 7.
- **Text:** a short version with a link to the book club page.
- **Sending rules:** the same as earlier book club blasts. Each person gets it once, opted-out people are skipped, and texts only go to people who agreed to receive them. Every email has an unsubscribe link.
- **Wording:** Storm Wellness Club voice, no emojis, and no "free."
- **Before anything goes out:** you send yourself a test copy. Nothing goes to members until you click send.

## 3. Next-round email (all active members)
- **Who gets it:** every active member except those already on the book club roster. Cancelled and opted-out members are excluded.
- **Message:** introduces the book club, says the first book was chosen, and invites them to sign up and suggest books for the second round.
  - Voting closes Sunday, November 15.
  - The meeting is Thursday, January 7.
- **Sending:** email only, with the same rules, a test send, and a send button.

## 4. Book club page updates
- **Results:** the vote shows as closed, with *The 48 Laws of Power* as the winner and the December 3 meeting.
- **Next round:** a section saying sign-ups and book suggestions are open. Book choices will be added once you send the new list.
- **Day choice removed:** the sign-up form no longer asks Thursday evening or Sunday twilight. It states that meetings are Thursday evenings, 7:00–9:00 PM.

## Waiting on you
- The book list for the next ballot, after sign-ups and suggestions come in. Voting will open when you send it.

## Technical details
- The vote is added through a data change.
- The announcement and next-round panels reuse the existing book club sending function with a new message type for each, plus their recipient lists.
- The admin page gets the two new panels.
- The book club settings file gets the winner, meeting dates and the next-round close date.
- The day choice on the sign-up is hidden. Answers people already gave are kept.
