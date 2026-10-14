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

## Part 2: Import the Mindbody list (same rules as the website list)
The file has roughly 1,380 people, about 1,270 with phone numbers.
- Read every name, email and phone from the PDF (phone numbers are split across two lines there; they'll be rejoined).
- Cross-check against everyone already in the system: contacts, members, non-member accounts, blocked addresses. Match by email (any capitalization) and by phone (last 10 digits).
- Add only new people. For existing people, fill a phone number only if we have none on file; never overwrite.
- Text consent recorded as prior-system consent, same as your other lists. Cancelled and blocked people are never added as eligible.
- Skip people with no email and no phone, test/club addresses, and in-file duplicates. Phone-only matches with a different email are held for your review, not merged.
- Flag obvious typos (like "gamil.com", ".con") in the review file rather than guessing.
- Give you a summary file: added, phones filled, held for review, already present, skipped.

## Technical details
- New edge function `email-unsubscribe` (verify_jwt false): GET shows the page, POST handles RFC 8058 one-click. Token = HMAC(email) using an existing server secret; sets `marketing_contacts.unsubscribed_at` (upserts a row if the person isn't a contact).
- Headers: `List-Unsubscribe: <https://…/email-unsubscribe?e=…&t=…>` plus `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, built per recipient in `send-body-roller-presale-email` and `process-promotion-emails`; footer links use the same URL.
- Mindbody import via pdftotext layout parsing, then cross-reference and insert into `marketing_contacts` with `source='import'`, paged lookups (no 1,000 cap). Summary CSV to Files.
