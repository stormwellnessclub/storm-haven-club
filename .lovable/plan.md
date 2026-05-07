# Marketing Contacts Import

Build a Marketing Contacts list inside the admin marketing portal with CSV upload, automatic member matching, segment grouping, and full duplicate protection. Then import the attached Mailchimp roster (~2,601 contacts).

## 1. New table: `marketing_contacts`

Fields:
- `email` (unique, lowercased)
- `first_name`, `last_name`, `phone`
- `segment` — `member`, `non_member`, `prospect` (auto-assigned)
- `source` — e.g. `mailchimp_import_2026_05`, `manual`, `auto_sync`
- `email_marketing_opt_in` — defaults `true` (these come from existing email list)
- `unsubscribed_at` — null unless they opt out
- `linked_member_id`, `linked_non_member_id` — links to existing records
- `tags` — text array
- `external_metadata` — jsonb for Mailchimp fields (OPTIN_TIME, source, member rating, last activity)
- `imported_at`, `created_at`, `updated_at`

RLS: only admins/marketing role can read/write.

A trigger keeps `segment` accurate — if a contact later becomes a member, their row flips automatically.

## 2. CSV Upload UI

New page: **Admin → Marketing → Contacts → Import**

Flow:
1. Drag-and-drop CSV.
2. Auto-detect Mailchimp format (Email Address, First Name, Last Name, Phone Number, Source, OPTIN_TIME, etc.). Also supports plain `email` columns.
3. **Preview screen** before commit:
   - Total rows, valid emails, invalid emails
   - Within-file duplicates (collapsed)
   - Already in `marketing_contacts` (skip)
   - Matched to existing member → `member`
   - Matched to existing non-member profile → `non_member`
   - Unmatched → `prospect`
4. Click **Import** → batched insert (chunks of 500), tagged with source + filename + date.
5. Final report with downloadable CSV of skipped rows.

## 3. Contacts list view

Page: **Admin → Marketing → Contacts**
- Master-detail layout.
- Stat cards: Total, Members, Non-members, Prospects, Unsubscribed.
- Filters: segment, opt-in, source, tag.
- Search by email/name/phone.
- Side panel: full contact, links to member/non-member record, source history, Unsubscribe / Tag / Delete actions.
- Export filtered list as CSV.

## 4. Dedupe logic (strict)

Every email normalized (`lower(trim(email))`) and checked against:
1. Other rows in same CSV → first occurrence kept.
2. Existing `marketing_contacts` → skip.
3. Invalid format → reject.

Unique index on `lower(email)` enforces this at the DB layer.

## 5. Auto-grouping (members vs non-members)

Server function during preview:
- Joins emails against `members` (case-insensitive) → segment `member`.
- Joins remainder against `non_member_profiles` → segment `non_member`.
- Rest → `prospect`.

Trigger keeps it in sync going forward when new members/non-members are created.

## 6. After build: import the attached Mailchimp file

Once the page is live, I'll run the upload with your file:
`subscribed_email_audience_export_4785c1fe3b.csv` (2,601 rows). You'll see the preview counts and approve before commit.

## Technical notes

- Migration: create `marketing_contacts`, indexes (`lower(email)` unique, `segment`, `source`), RLS, sync trigger, and SECURITY DEFINER RPC `import_marketing_contacts(rows jsonb, source text)` that does dedupe + match + insert atomically and returns report counts.
- CSV parsing in browser via `papaparse`.
- Batch size 500 per RPC call.
- Zod validation on email format client-side and server-side.

## What I will NOT do

- Won't send any marketing emails as part of this — strictly importing the list.
- Won't overwrite member or non-member profile data.
- Won't auto-opt-in for SMS — email only.