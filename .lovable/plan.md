# Unfinished applications: why the list stopped growing

## What I found

Tracking never stopped. New unfinished attempts are still being recorded every few days — the most recent was September 9 (Kay Price), with 43 in the last 30 days.

The reason nothing new appears after Ray Haidar (August 21) is the filter built into the list: any attempt whose email already exists on a submitted application or a member record is hidden completely. Of the 16 people who started card setup since August 21, 15 already have an application or a member record, so they were all silently removed. Only one genuinely unfinished person remains in that window (Sidra Sinan, September 3).

So the list is technically right, but it hides so much that it looks broken and you can't tell the difference between "nobody new" and "everyone new was auto-hidden".

## What I'll change

1. **Show hidden people instead of silently dropping them.** The Filtered group becomes visible by default as a labeled section with a count: "Finished later — 15" with a per-person reason chip (Already applied / Already a member / Test email) and the date they started.
2. **Stop hiding people who never actually finished.** Only treat an attempt as resolved when the matching application or member record was created on or after the attempt date. An old, unrelated record no longer erases a fresh unfinished attempt.
3. **Add a "Last activity" summary bar** at the top: newest attempt date, attempts this week, attempts this month — so you can immediately tell whether tracking is live.
4. **Make the sidebar badge honest.** It keeps counting only genuinely unfinished people, with a tooltip showing how many were hidden as finished.
5. **Include the people who quit before the card step.** Attempts recorded on the application form itself (started but never submitted) get folded in as a "Left the form" group, so the tab covers every drop-off point, not just card entry.

## Technical notes

- `src/hooks/useAbandonedApplications.ts`: pass application/member `created_at` into the match sets and compare against the attempt timestamp before assigning `filterReason`; add `application_submit_attempts` (non-succeeded rows) as a fourth group; add `lastAttemptAt` / `last7` / `last30` to `totals`.
- `src/components/admin/AbandonedApplicationsTab.tsx`: render the summary bar, the always-visible resolved section with reason chips, and the new form drop-off group.
- `src/components/admin/AdminSidebar.tsx`: tooltip on the badge with the hidden count.
- No database or schema changes; read-only queries only. All dates rendered in `America/Detroit`.
