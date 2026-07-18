## Root cause (confirmed)

The admin Event Vote page reads `event_votes` and `event_vote_tallies` directly via the client, but neither has `GRANT` for the `authenticated` role in Postgres:

```
grantee      | privilege_type
-------------+---------------
sandbox_exec | INSERT / SELECT
(no rows for authenticated / anon / service_role)
```

Meanwhile the data itself is fine — 10 votes exist, tallies compute correctly (Saturday 5, Either 3, Friday 2), and RLS policies already allow super_admin/admin to read every row. But PostgREST checks table-level `GRANT` *before* RLS, so every admin query silently returns an empty set. That's why the Live Tally shows 0 and "No votes yet" renders even though the rows are there.

(Votes still get cast because upserts go through the anon/auth key with default grants that existed when the table was created; a later security migration revoked the standard grants without re-adding them.)

## Fix

Single migration that restores the required grants — no code changes, no RLS changes.

```sql
GRANT SELECT, INSERT, UPDATE ON public.event_votes TO authenticated;
GRANT DELETE               ON public.event_votes TO authenticated; -- admins delete policy already gates this
GRANT ALL                  ON public.event_votes TO service_role;

GRANT SELECT ON public.event_vote_tallies TO authenticated;
GRANT SELECT ON public.event_vote_tallies TO anon; -- tallies are public-safe aggregates shown on voting card
GRANT ALL    ON public.event_vote_tallies TO service_role;
```

## Verification

1. Reload `/admin/event-votes` — Total votes: 10, Members: 8, Non-Members: 2, individual table lists all 10 voters with names/emails resolved from `non_member_profiles` and (where applicable) `members`.
2. `/admin/events` summary card reflects the same 10 total.
3. Member/non-member voting card on the portal still tallies live.
