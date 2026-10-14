# Combined Wix + Mindbody import, and automatic unsubscribes

## Where Claude and I agree
- Claude's cleaned file is the source of truth. It has 3,632 unique people from Wix (2,763) and Mindbody (2,666). I will not re-process the raw exports.
- 17 people are excluded (test accounts, or no email and no phone).
- 166 possible pairs stay unmerged until you decide (same email with different names, shared family phones, same name with different contact info).
- Consent follows your rule: everyone with an email is opted in to email, and everyone with a phone to texts. The exceptions are the 2 spam reporters and the 12 bounced emails.
- Any opt-out already in our system wins: an unsubscribe, a STOP text, or a blocked address.
- The unsubscribe problem is real. Unsubscribe requests land in admin@ and are never recorded.

## Differences I'll account for
- The website list was partly imported last week (163 new people). Those rows will match as existing contacts and get updated, not duplicated.
- Texts are partly done already. STOP/START now updates every contact source, and imported contacts are reachable from Targeted Texts with consent checks. I'll confirm this against Claude's list. The remaining gap is that the older Compose SMS screen only reaches account holders.
- Claude found that Compose Email does not skip unsubscribed or blocked people. I'll fix that too.

## Step 1: Count first, write nothing
Match every email and phone on each row, including the extra ones, against members, accounts, non-member profiles, contacts, SMS leads, applications, guest passes, pending imports and blocked people. Matching uses Claude's rules: lowercase emails, Gmail dots and +tags ignored, phones as 10 digits.

I'll then report:
- people who match a member
- people who match a non-member
- people who match an existing contact
- new people to add
- people skipped because they are blocked or opted out

Nothing is imported until you say go.

## Step 2: Import (after your go)
- Members and non-member accounts stay the master record. I only fill a missing phone; status, name and email are never changed, and no duplicate contact is created.
- For existing contacts, I fill only missing fields and add the Mindbody ID.
- New people are added as prospects tagged "Wix + Mindbody Oct 2026", with consent from the file.
- Opt-outs always win.
- You get a summary file of the results.

## Step 3: Automatic unsubscribes for every marketing email
- Every marketing email gets its own secure unsubscribe link and the one-tap inbox Unsubscribe button. One tap records the opt-out right away, and nothing goes to admin@.
- A simple Storm Wellness Club confirmation page offers "Resubscribe".
- One shared rule blocks unsubscribed, blocked, bounced and spam-reported addresses. It applies to the Body Roller campaigns, Sale/Promotion emails and Compose Email.
- Receipts and bookings still send.
- Optionally, I'll record bounces and spam complaints automatically.
- Catch-up: paste the addresses from the unsubscribe emails in the admin inbox and I'll mark them.

## Technical details
- New public edge function `email-unsubscribe`. GET shows the page; POST handles RFC 8058 one-click. It uses an HMAC token per email and sets `unsubscribed_at` and `opted_in_email=false` on all matching rows.
- Per-recipient `List-Unsubscribe` and `List-Unsubscribe-Post` headers, plus a footer link, in `send-body-roller-presale-email`, `process-promotion-emails` and `send-email` (marketing mode).
- A shared `_shared/marketingSuppression.ts` does paged lookups.
- The import runs through data queries with paged lookups, not the `import_marketing_contacts` RPC. It sets `source='import'` and `source_label='wix_mindbody_2026_10'`, and stores `mindbody_ids` in `external_metadata`.
