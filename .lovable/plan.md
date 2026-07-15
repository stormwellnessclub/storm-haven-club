# Add credit history to the member Credits panel

Front desk already reaches the Credits tab through `MemberDetailSheet` (viewerMode="frontdesk"), which renders `MemberCreditsPanel`. That panel today only shows current balances — no historical log. Add a "Recent activity" section that reads from `credit_adjustments` so front desk (and admins) can see who used/added credits and when.

## Changes

**`src/components/admin/MemberCreditsPanel.tsx`**
- Add a second `useQuery` (`["member-credit-history", memberId]`) that selects the last 50 rows from `credit_adjustments` for this `member_id`, ordered by `created_at desc`. Join staff name via a lightweight `profiles` lookup on the returned `adjusted_by` ids (batch fetch, same pattern used in `src/pages/admin/MemberCredits.tsx`).
- Invalidate this query alongside the existing `invalidate()` after an adjustment so the log updates immediately.
- Render a new Card ("Recent credit activity") below the balances Card:
  - Empty state: "No credit activity yet."
  - Each row: +/- amount pill (green for add, red for remove), credit type label (using `CREDIT_TYPE_LABELS`), previous → new balance, reason, staff name, relative timestamp (`formatDistanceToNow`) with exact time on hover via `title`.
  - Collapsible: show first 8 rows, "Show all (N)" toggle to expand.

## Access / RLS

`credit_adjustments` already has policies that allow staff roles (front desk / admin / super_admin) to SELECT. No RLS or GRANT changes needed — verify by reading a sample row from `credit_adjustments` during implementation; if the front-desk role is missing, add a matching `has_any_role(...)` SELECT policy in a migration.

## Out of scope

- No changes to admin `/admin/member-credits` page (already has full history).
- No changes to Cafe Credit ledger (already visible via `CafeCreditPanel`).
- No changes to write paths — logging on adjust/book-on-behalf already exists.
