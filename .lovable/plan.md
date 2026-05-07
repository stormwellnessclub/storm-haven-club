# Import Mailchimp roster into Marketing Contacts

The Marketing → Contacts system is already live. Now run the actual import of your attached file `subscribed_email_audience_export_4785c1fe3b-2.csv` (2,601 rows) directly server-side — faster and more reliable than uploading through the browser for a list this size.

## Steps

1. **Stage the CSV** — copy your uploaded file into the sandbox and load it into a temp table via `psql COPY`.
2. **Normalize rows** — extract `email` (lowercased/trimmed), `first_name`, `last_name`, `phone`, and stash the remaining Mailchimp columns (`OPTIN_TIME`, `Source`, `MEMBER_RATING`, `Last Activity`, `TAGS`, `LEID`, `EUID`) into `external_metadata` JSONB.
3. **Run the existing `import_marketing_contacts` RPC** in batches of 500 with `_source_label = "mailchimp_roster_2026_05_07"`. The RPC already handles:
   - Invalid email rejection
   - Within-file dedupe
   - Skip if already in `marketing_contacts`
   - Auto-segment match against `members` → `non_member_profiles` → `prospect`
4. **Report results** — show counts: total, inserted (by segment), skipped existing, skipped duplicate, skipped invalid. Spot-check by querying a few member matches.

## What I will NOT do

- No edits to the import UI, table schema, or RPCs — those are already in place.
- No marketing emails sent.
- No overwrite of any member or non-member profile data.

After approval I'll execute the import and return the final counts.
