## Problem

When you click "Mark resolved" on a payment issue in the member profile, the row is correctly written to the database (`resolved_at` is set), but two things go wrong from your perspective:

1. The card only ever queries unresolved rows, so resolved issues vanish entirely — there's no way to review what you cleared, who cleared it, or why.
2. If the list doesn't visibly update right away, it can look like "mark resolved" didn't work.

You want resolved issues to stay accessible for review, just not mixed in with active ones.

## Solution

Add tabs inside the existing **Confirmed Payment Issues** card on the admin member profile:

- **Open** (default) — current behavior. Unresolved failures and active disputes, grouped by category, with Retry / Mark resolved / Stripe links. Count badge in header reflects this tab only.
- **Resolved** — historical list of resolved issues for this member. Read-only review view.

No deletion. No change to the underlying `payment_attempts` table. Same data, just a second view.

### Resolved tab contents

Each resolved row shows:
- Amount + category badge (Membership Dues, Café, Spa, etc.)
- Original failure/dispute reason
- Date originally failed
- **Resolved on** date + **resolved by** (admin email, looked up from `resolved_by` user id)
- Resolution note (if one was entered)
- Stripe link (invoice / charge / payment intent) when available
- An **Unresolve** button (ghost, small) in case something was cleared by mistake — clears `resolved_at`, `resolved_by`, `resolution_note` and moves it back to Open

Sorted by `resolved_at` descending, capped at the most recent 50 with a "Load more" affordance if needed.

### Header behavior

- "X open" badge stays, but only counts the Open tab.
- When Resolved tab has rows, show a muted secondary count next to the tab label (e.g. `Resolved · 12`).

## Technical notes

Files touched:

- `src/hooks/useMemberConfirmedIssues.ts`
  - Add a second query `useMemberResolvedIssues(memberId)` that selects rows where `resolved_at IS NOT NULL` (or `dispute_status = 'won'` for the disputed-but-now-resolved case), ordered by `resolved_at desc`, limited to 50. Join/lookup `resolved_by` against a profiles/admin users source already used elsewhere in admin (check `useAdminMemberBillingHealth` for the existing pattern) — fall back to showing the raw id if no lookup is available.
  - Add an `unresolveAttempt` mutation that sets `resolved_at = null`, `resolved_by = null`, `resolution_note = null` and invalidates both queries.
  - Ensure `markResolved.onSuccess` also invalidates the resolved-issues query so the item appears in the Resolved tab immediately.

- `src/components/admin/MemberDetail/ConfirmedPaymentIssues.tsx`
  - Wrap the existing body in `Tabs` (`Open` / `Resolved`) using the existing `@/components/ui/tabs` primitives.
  - Extract the current grouped/rendered list into an `OpenIssuesList` subcomponent so the file stays readable.
  - Build a `ResolvedIssuesList` subcomponent for the new tab.
  - Header count badge reads from the open-issues query only.

No database migration is required — `resolved_at`, `resolved_by`, `resolution_note` already exist on `payment_attempts` and are populated by `markResolved`.

## Out of scope

- Bulk actions on resolved issues
- Filtering/search inside the Resolved tab (can add later if the list grows)
- Surfacing resolved issues anywhere outside the member profile
