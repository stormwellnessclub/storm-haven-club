## Problem

The Abandoned Applications tab counts every `card_setup_attempts` row with no `application_id` and status `initiated`/`abandoned`. But many of those people later went on to actually submit an application (or already became members) under the same email — they aren't truly abandoned, they just have an old card-setup attempt that was never linked back.

## Fix

In `src/components/admin/AbandonedApplicationsTab.tsx`, after fetching the raw `card_setup_attempts`, filter out any attempt whose `metadata.applicant_email` (case-insensitive) matches:

1. An existing row in `membership_applications` (any status — submitted, approved, rejected, etc.), OR
2. An existing row in `members` (they already converted).

Implementation:
- Collect the unique lowercased emails from the fetched attempts.
- Run two parallel queries: `membership_applications` filtered by `email.in.(...)` and `members` filtered by `email.in.(...)`, selecting only `email`.
- Build a `Set` of lowercased "already applied/joined" emails.
- Drop those from the deduplicated list before returning.

The header count (`{abandonedAttempts.length} abandoned application(s) found`) then reflects the true number of truly-abandoned applicants — people who started the card-setup flow but never submitted an application and never became members.

## Out of scope

- No schema changes.
- No changes to the reminder-sending logic or the underlying `card_setup_attempts` data — just the display filter on this tab.
- No change to other "abandoned" lists (class pass checkouts, etc.).
