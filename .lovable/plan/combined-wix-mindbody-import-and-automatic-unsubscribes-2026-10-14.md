# Combined Wix + Mindbody import, and automatic unsubscribes

## Where Claude and I agree
- Claude's cleaned file is the source of truth: 3,632 unique people from Wix (2,763) and Mindbody (2,666). I won't re-process the raw exports.
- 17 people are excluded (test accounts, or no email and no phone).
- 166 possible pairs stay unmerged until you decide.
- Consent follows your rule: an email means email opt-in and a phone means text opt-in. The 2 spam reporters and 12 bounced emails are excepted.
- An opt-out already in our system always wins (unsubscribe, STOP text, or blocked).
- Unsubscribe requests currently land in admin@ and are never recorded.

## Order of work
1. Step 0 and Step 1 reports go to you. Nothing is written.
2. Step 3 (automatic unsubscribes) is built, and the admin inbox catch-up is done.
3. Step 2, the import, runs after your go. It may run before Step 3 is finished because nothing sends on import.
4. Only then can any email or text go to the new list.

## Step 0: Re-check last week's 163 website contacts
- Find any of the 163 whose phone matches a member, a non-member, or another contact under a different email, and list them for your decision.
- Confirm whether text opt-in was set on each. Last week 97 were set to yes and 66 were email-only; I'll re-verify against the database.

## Step 1: Count first, write nothing
Every email and phone on each row, including the extra ones, is matched against members, accounts, non-member profiles, contacts, SMS leads, applications, guest passes, pending imports and blocked people. Matching uses Claude's rules.

Report:
- Counts: matched members, matched non-members, matched existing contacts, new people, and people skipped as blocked or opted out. These must total exactly 3,632, and any gap will be explained.
- Conflicts list: anyone whose email matches one record and whose phone or second email matches a different record. These are shown to you, never guessed.
- Members' phones:
  - members whose missing phone would be filled
  - members whose phone on file differs from the file (reported only, never overwritten)
- How many imported phones already have a STOP on record.
- Automatic sends check: confirm that nothing (welcome email, drip sequence or text) fires when contacts are added. If something does, it is switched off for this batch.

The report comes back to you as lists before anything is imported.

## Step 2: Import (after your go)
- Members and non-member accounts stay the master record; only missing fields are filled.
- Existing contacts get missing fields plus the Mindbody ID.
- New people are added as prospects.
- Opt-outs always win.
- Undo:
  - Every added or changed row is tagged wix_mindbody_2026_10.
  - A before-copy of every existing row changed is kept so the whole import can be reversed.
- You get a results summary file.

## Step 3: Automatic unsubscribes
- Every marketing email gets a footer with an unsubscribe link and the club address (18340 Middlebelt Rd, Livonia, MI 48152).
- The inbox one-tap Unsubscribe button is switched from emailing admin@ to recording the opt-out automatically. This includes the Body Roller emails.
- Unsubscribe links never expire.
- Unsubscribing covers every record with that person's email (contacts, accounts, non-member profiles).
- A confirmation page offers "Resubscribe".
- One shared skip rule (unsubscribed, blocked, bounced, spam) applies to the Body Roller emails, Sale/Promotion emails, and Compose Email campaigns, which will now always send in marketing mode.
- Receipts, bookings and account emails are unaffected.
- Catch-up: paste the addresses from the unsubscribe emails in admin@ and I'll mark them before any send.

## Technical details
- New public edge function `email-unsubscribe`. GET shows the page; POST handles RFC 8058 one-click. Each link carries an HMAC token over the lowercased email with no expiry. The function sets `unsubscribed_at` and `opted_in_email=false` on `marketing_contacts`, plus email opt-out flags on `profiles` and `non_member_profiles` where those exist.
- Shared `_shared/marketingEmail.ts` handles headers (`List-Unsubscribe`, `List-Unsubscribe-Post`), the footer and paged suppression. It is used by `send-body-roller-presale-email`, `process-promotion-emails`, and `send-email` when called from `ComposeEmailDialog`; transactional calls are untouched.
- New table `import_change_backup` (row JSON before change, tag, table, id) with admin-only RLS and grants.
- Inspect triggers on `marketing_contacts`, plus the `marketing_sequence_enrollments` triggers, before the import.
- The import uses paged data queries, not the `import_marketing_contacts` RPC.
