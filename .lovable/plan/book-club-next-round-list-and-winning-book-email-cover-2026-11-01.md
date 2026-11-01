# Book club: next-round list and winning-book email cover

## 1. Non-member on the next-round request list
The list has 3 people: Laial Beidoun (active member), Shams Al-Badry (active member) and **Danielle Marie Smith (not a member)**. Danielle is there because the book vote page lets non-members add their name for the next round, as you asked when we built the vote.

Change:
- Each person on the Round 2 list gets a label: **Member** or **Non-member**.
- Add a filter (All / Members / Non-members) so you can review them separately.
- Non-members stay on the list as leads. Nobody gets removed.

## 2. Real cover for The 48 Laws of Power in the email
Right now the winning-book email and the RSVP reminder use the same Higher Self Society banner as every earlier email.

Change:
- The winning-book announcement and RSVP reminder show the actual 48 Laws of Power cover (the same one on the book club page), under the banner, with the title and author.
- The next-round email to members keeps the banner, since no book has been picked yet.
- Check the cover in a test email preview before you send anything. Nothing goes to members.

## Technical details
- The admin Round 2 list in `SocietyBookVoteAdmin` checks `members` by lowercase email (and not cancelled) to set the label.
- In `send-society-last-call`, `buildHtml` gets an optional book cover block for the `book_winner` and `rsvp_reminder` audiences. It uses the cover URL for ISBN 9780140280197 from `societyBooks.ts`, copied into the `email-images` storage so email clients load it reliably. Then redeploy the function.
