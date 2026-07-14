# Fix: Sound Bath admin page shows blank voter names/emails

## Problem

`/admin/event-votes` renders the "Individual votes" table with every row showing `—` for Name and Email. Four votes exist in `event_votes`, but `EventVoteTracking.tsx` only joins `profiles` by `user_id` — and none of the current voters have a `profiles` row. Their identity actually lives in `non_member_profiles` (and, for `voter_type = 'member'`, `members` by email). CSV export has the same gap.

## Fix

Update `src/pages/admin/EventVoteTracking.tsx` so the voter query resolves identity from multiple sources in priority order:

1. Fetch votes from `event_votes` (unchanged).
2. Look up each `user_id` in parallel across:
   - `profiles` (id, first_name, last_name, email)
   - `non_member_profiles` (user_id, first_name, last_name, email, phone)
   - `auth.users` → not queryable client-side, so use email/name from the two tables above.
   - `members` matched by lowercased email from either source (first_name, last_name, membership_tier) to enrich member voters with their member name/tier.
3. Merge into each vote row: `name`, `email`, `phone`, plus an optional `member_tier` badge when found.
4. Update the table to render the merged name/email, keep the Member/Non-Member type badge, and add a small tier chip next to member names when available.
5. Update `exportCsv` to use the same merged fields (Name, Email, Phone, Type, Tier, Choice, Voted At).

Also update the `EventsHub.tsx` "unique voters" stat wording to just "voters" (count is already correct) — no data change needed.

No schema changes, no RLS changes. Query-only fix in one file.

## Files

- `src/pages/admin/EventVoteTracking.tsx` — replace the votes `useQuery` to merge `profiles` + `non_member_profiles` + `members`; update table cells and CSV export.
