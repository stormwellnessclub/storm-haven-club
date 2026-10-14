# Automatic unsubscribes + Mindbody list import

## Why admin@ gets the unsubscribe emails
The Body Roller campaign emails tell Gmail/Yahoo/Apple: "to unsubscribe, send an email to admin@stormwellnessclub.com." So when someone taps the Unsubscribe button at the top of their inbox, their mail app sends a message to your inbox, and nothing records it. Those people can still get the next campaign unless someone marks them by hand.

## Part 1: Make unsubscribes automatic
- Add a public unsubscribe link that is unique to each person (signed, so no one can unsubscribe someone else).
- The inbox Unsubscribe button and the footer link both use it. One tap marks the person unsubscribed in the contact list right away. No email goes to admin@.
- Show a simple Storm Wellness Club page: "You've been unsubscribed from marketing emails," with a "Resubscribe" option in case it was a mistake.
- Every group email already skips unsubscribed people, so they drop out of future sends automatically. Receipts, bookings and account emails still go out.
- Apply the same link to the other marketing emails (promotions), not just Body Roller.
- Catch-up: I'll ask you to forward or list the people who already asked by email, or read their addresses from the notifications if you paste them, and mark them unsubscribed. Nothing is sent.
- Inbox providers rate one-click unsubscribe highly, so this also helps keep emails out of junk.

## Part 2: Import the Mindbody list (using Claude's cross-check rules)
The file has all 2,666 Mindbody clients. Claude's review matches what I see, and I'll use its rules. Claude asked you to run a query in the backend yourself. You don't need to do that, because I can check the database directly.
- Read every name, email and phone from the PDF (phone numbers are split across two lines there; they'll be rejoined).
- Cross-check against everyone already in the system: contacts (including the website list imported earlier), members, non-member accounts, blocked addresses.
- Matching rules from Claude's review:
  - Same email (any capitalization; Gmail with or without dots counts as the same).
  - Same phone (last 10 digits) plus a matching first name, with spelling variants like Khadeji/Khadije and Fatima/Fatimeh.
- Add only new people. For existing people, fill a phone number only if we have none on file; never overwrite.
- Text consent recorded as prior-system consent, same as your other lists.
- Exceptions:
  - Anyone who unsubscribed, texted STOP, or is blocked stays opted out.
  - The 2 people who marked you as spam on Wix are unsubscribed.
  - The 12 Wix addresses that bounced are excluded from email.
- Clean-up:
  - Remove stormfitnessllc@gmail.com from Hanan Jaffar's record so marketing doesn't go to you.
  - Fix clear email typos (gamil.com → gmail.com, .con → .com).
  - Skip invalid phone numbers (9 digits, 123456789), test accounts, and people with no email or phone.
- Held for your review, not merged: the ~100 same-name/different-contact pairs, 56 shared family phones, and 26 shared emails (Claude's lists).
- Give you a summary file: added, phones filled, held for review, already present, skipped.

## Technical details
- New edge function `email-unsubscribe` (verify_jwt false): GET shows the page, POST handles RFC 8058 one-click. Token = HMAC(email) using an existing server secret; sets `marketing_contacts.unsubscribed_at` (upserts a row if the person isn't a contact).
- Headers: `List-Unsubscribe: <https://…/email-unsubscribe?e=…&t=…>` plus `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, built per recipient in `send-body-roller-presale-email` and `process-promotion-emails`; footer links use the same URL.
- Mindbody import via pdftotext layout parsing, then cross-reference and insert into `marketing_contacts` with `source='import'`, paged lookups (no 1,000 cap). Summary CSV to Files.
