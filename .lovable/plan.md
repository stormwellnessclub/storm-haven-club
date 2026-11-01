# Book Club: "Currently Reading", member portal, and RSVPs

## 1. Book club page
- **Top section:** "Currently Reading" shows *The 48 Laws of Power* by Robert Greene, with the cover, a short synopsis and the first gathering: Thursday, December 3, 7:00–9:00 PM.
- **RSVP:** signed-in book club members see "Will you be joining us?" with Yes, Maybe and Can't make it buttons. They can change their answer anytime, and a short note shows their current answer.
- **Next round:** a "Join the next round" section with the sign-up form and book suggestions.
  - Voting closes Sunday, November 15.
  - The book is chosen by the end of November.
  - The meeting is Thursday, January 7.
- **Old vote:** the closed first-round vote list moves lower on the page as "First round results," or is removed. I'll keep it smaller underneath.

## 2. Member portal
- **Book club members:** their book club card changes to show:
  - "Currently Reading: The 48 Laws of Power" with the cover.
  - The first gathering: Thursday, December 3, 7:00–9:00 PM.
  - Their RSVP status, with RSVP buttons right on the card.
- **Members not in the book club:** they keep the invitation, now worded "Join the next round."

## 3. RSVPs for staff
- **Where:** a new RSVP section on Admin → Book Club Sign-ups.
- **Counts:** Yes, Maybe, Can't make it and No reply, out of everyone on the book club list.
- **List:** names with each person's answer, searchable.
- **Download:** a spreadsheet export.
- **Reminder:** an "RSVP reminder" email and text that goes only to people who haven't replied. It follows the same rules as the other blasts: a test send first, unsubscribed people skipped, texts only to people who agreed to them, and each person gets it once.

## 4. Winning book email and text
- Before you send them, the button changes to "RSVP for December 3," which takes people straight to the RSVP spot.
- Both messages mention RSVPs.

## Rules
- Only people on the book club list can RSVP. Others see the sign-up instead.
- Each person has one RSVP per meeting, and it can be changed.
- Staff can see all RSVPs. Members only see their own.
- The January 7 meeting can use the same RSVP setup later.

## Technical details
- A new meeting RSVP table with one answer per person per meeting. Members can add or change only their own answer, and staff can read all answers.
- Book club eligibility uses the existing roster check.
- The meeting details live in the book club settings file.
- The page and portal card share one RSVP control.
- The book club sending function gets an RSVP reminder message type and updated button text and link for the winning book.
- The member dashboard card gets the reading and RSVP view.
