# Monthly New Members Report

A permanent admin report showing how many members signed up and were activated each month, so the numbers can be pulled up anytime instead of asked for.

## What you get

A new page under Membership Management called **Growth Report**:

- Month-by-month table: new members, still active, frozen, cancelled since, and net change.
- A simple bar chart of new members per month, with a line for net growth.
- Year-to-date and trailing-12-month totals at the top.
- Date-range picker (defaults to all time) and a "download CSV" button for meetings.
- A footnote flagging the pre-launch group (Dec 2025 / Jan 2026) whose records predate activation tracking.

## How a month is counted

A member counts in the month they were activated. For members activated through the system that is their activation date; for the founding group entered before activation tracking existed, the membership start date is used. People still sitting at "pending activation" are excluded, since they never paid. All dates use Michigan time.

## Technical notes

- New database function `get_monthly_member_growth(start_date, end_date)`, SECURITY DEFINER, restricted to super_admin / admin / manager, returning one row per month: month, new_members, still_active, frozen, cancelled, legacy_backfilled, with_recorded_payment.
- Month key: `date_trunc('month', coalesce((activated_at at time zone 'America/Detroit')::date, membership_start_date))`, excluding `status = 'pending_activation'`.
- Payment confirmation derived from an existing succeeded row in `payment_attempts` for that member; surfaced as a data-quality column, not as a filter.
- New page `src/pages/admin/MemberGrowthReport.tsx` + hook `useMemberGrowth.ts` (React Query), route `/admin/member-growth`, sidebar entry under Membership Management with the same role gating as other financial views (hidden from front desk).
- Chart uses the existing recharts setup and semantic tokens; CSV export built client-side from the same rows.
