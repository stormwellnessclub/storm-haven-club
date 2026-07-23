
## Two issues to fix

### 1. Non-member detail page crashes for some accounts
`NonMemberAccounts.tsx` lists two groups of accounts:
- Real rows in `non_member_profiles` (597)
- "Orphaned" users found in `class_passes` who have no `non_member_profiles` row (5)

When you click an orphan, we navigate to `/admin/non-member-accounts/:userId`, which calls
`.from("non_member_profiles").select("*").eq("user_id", ...).single()`. Because no row exists, `.single()` throws
and the page shows nothing / an error. Same failure happens for any row whose profile was deleted.

**Fix:** auto-create the `non_member_profiles` row on demand from `profiles` when the detail page loads and no
non-member row exists. Use `maybeSingle()` + a fallback insert (email/name/phone pulled from `profiles`). No user
action required — clicking a name always opens their file cleanly.

### 2. "Missing waiver" count is wrong

The system enforces the liability waiver at every booking + pass-purchase entry point, so nobody with an active
pass or a class booking should show as "missing waiver". Confirmed against the data:

- 549 non-members show `waiver_signed = false`
- 224 of them own class passes
- **195 of those 224 already have booked or attended classes** — impossible unless the waiver was actually signed

Root cause: `waiver_signed` is a single boolean set only by the in-app "Sign waiver" click. Passes bought via
Stripe payment links, front-desk POS, bulk imports, and admin grants never flip the flag, so the badge lies.
There is no separate signatures table to cross-check.

**Fix — treat waiver as signed when there is any hard evidence of it, and expose the source:**

Add a database function `public.effective_waiver_status(_user_id uuid)` that returns:
- `signed` — flag is true, OR they have any completed class booking (attendance implies waiver signed at the door
  or in-app), OR they have any active/used class pass (purchase flow forces waiver)
- `unsigned` — no flag, no booking, no pass
- plus `signed_at` (from `non_member_profiles.waiver_signed_at`) and `source`
  (`explicit` / `inferred_booking` / `inferred_pass` / `none`)

Backfill migration: for any `non_member_profiles` row where `waiver_signed IS NOT TRUE` **and** the user has a
class booking with status in ('confirmed','completed','no_show') or an active/used class pass, set
`waiver_signed = true` and `waiver_signed_at = coalesce(earliest booking created_at, earliest pass created_at)`.
This only touches rows with objective proof of signing.

Update the admin UI:
- `NonMemberAccounts.tsx` — recompute the "Missing Waiver" stat and column badge from the effective status, not
  the raw boolean. Show a tooltip on inferred-signed rows explaining the source ("Signed via class booking on
  Mar 3, 2025").
- `NonMemberDetail.tsx` — waiver card shows: badge (Signed/Unsigned), signed date, and source. If unsigned but
  inferred (e.g. record predates the flag), show an admin one-click "Mark as signed on paper" that writes
  `waiver_signed = true, waiver_signed_at = now()` and logs to `admin_action_log`.
- Add a filter chip: **Truly missing waiver** vs. **Signed (inferred)** vs. **Signed (explicit)** so you can see
  who genuinely still needs to sign digitally.

## Technical section

Files:
- `supabase/migrations/*` — new `effective_waiver_status` function + one-shot backfill UPDATE, plus permissive
  GRANT to `authenticated`.
- `src/pages/admin/NonMemberDetail.tsx` — swap `.single()` → `.maybeSingle()`, auto-create row from `profiles` if
  null, and load effective waiver status.
- `src/pages/admin/NonMemberAccounts.tsx` — fetch `effective_waiver_status` per row (single RPC returning table
  by user_ids), recompute `missingWaivers` stat and the waiver column, add filter values.
- `src/components/admin/NonMemberDetailSheet.tsx` — same waiver badge/source logic.
- `src/hooks/useNonMemberProfile.ts` — expose `waiverStatus` field (signed/unsigned/source/date).

Members table (`profiles.waiver_signed`) has the same class of stale-flag problem; scope this plan to
non-members since that's what you asked about. I can apply the same treatment to members in a follow-up if you
want.

No changes to booking/purchase flows — those already enforce the waiver correctly.
