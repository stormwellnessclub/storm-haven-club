# Seasonal Edit: what's actually happening, and a sales plan for the last 5 days

## The honest numbers (Nov 21 to today)
- **About 9,450 emails were delivered across 3 rounds. 695 bounced, about 7%.** A bounce rate that high tells Gmail and Outlook that we're a bulk sender. That's a big reason emails land in spam.
- **Open and click tracking was added after those sends, so we have no open or click data for any of them.** Blasting the same lists again won't tell us anything new.
- **Texts did go out on Nov 21, 22 and 24, about 3,300 sent.** Twilio stopped working after that, so the texts set for this week won't go out until the account is fixed.
- **The only Seasonal Edit sales so far are PT packages sold by you and staff in person:** Elizabeth, Linda, Latife, Ammanee, Maysa and others. One gift card ($120) and a few class purchases came in online.
- **Conclusion:** your personal sales work. Blast emails don't. The plan below puts most of the effort into the sales that work and spends far less on blasts.

## The plan (Nov 25 to 30)

### 1. A personal "hot list" for you and staff (main focus)
A new page in Admin → Campaign Studio → **Hot list**. It ranks real people most likely to buy:
- PT clients whose package is running low or ending soon, like Latife was.
- People paying single-session prices with no package, like Liliane and Ava were.
- Members who visited in the last 30 days and haven't bought anything from the Seasonal Edit.
- People who booked a massage in the last 6 months.
- Non-members who took a class in the last 60 days.

Each row shows their name, why they're on the list, what to offer and the price. Two buttons:
- **Copy personal text:** a short message written in your voice, for you to send from your own phone. That works even while Twilio is down.
- **Mark as contacted / bought.**

For the hot list, quality matters more than volume: about 40 to 80 people, sent by you or by trainers.

### 2. Trainers sell PT to their own clients
Each trainer gets a printable list of their own clients, with their package status and the Seasonal Edit price for each. In-person conversations are what has sold so far.

### 3. In-club, during visits this week
- A one-line front desk script for every check-in: "Have you seen the Seasonal Edit? It ends Sunday."
- A printable counter card with a QR code to the Seasonal Edit page. No processing fee and never the word "sale".

### 4. Only 2 more emails, to people who can actually get them
- Send only to members, active non-members and people who visited or bought this year. **Leave out the 2,500 imported contacts**, which caused most of the bounces.
- **Email A, Fri Nov 27:** a plain, personal email from you, written like a real person rather than a flyer. Three offers, prices included, one button each.
- **Email B, Sun Nov 30, morning:** "Ends tonight at 11:59 PM," with three links.
- These emails will have open and click tracking, so Results finally shows who opened, who clicked and who bought.

### 5. Instagram, since you post there yourself
I'll write 5 short captions, one per day, and match them to your existing real flyers. No new imagery.

### 6. Texts
These go out only if Twilio is active again by Saturday: one "ends tonight" text on Sunday, only to people who opted in. If Twilio is still down, the hot list covers this.

## What will not happen
- The 23 drafted "Seven Openings" emails stay unsent. They were too many and too generic.
- No messages go out without your approval of the final wording.
- No member pricing on gifts for other people.

## What I need from you
- Whether you'll personally send texts from the hot list, or want trainers and front desk to send them too.
- Whether Twilio has been fixed.

## Technical details
- Hot list: a new admin RPC that reads pt_passes (low/ending, no-package unpaid sessions), check_ins, spa_appointments, class_bookings and revenue_ledger (excluding anyone who already bought a Seasonal Edit item), with a new `marketing_outreach_marks` table for contacted/bought status (admin/manager RLS).
- Trainer list: the same RPC filtered by pt_client_trainers, with a print view.
- Emails: Campaign Studio, with a new audience key "engaged_this_year" that excludes imported contacts and suppressed/bounced addresses. The tracking pixel and links are already built.
- Counter card and front desk script: a printable admin page.
- No changes to pricing or checkout.
