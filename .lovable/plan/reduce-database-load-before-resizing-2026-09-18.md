# Reduce database load before resizing

Your database is not short on space (9% of disk, 330 MB) and connections are barely used (22 of 60). Memory sits at 63%. The pressure is coming from how often the staff screens ask the database the same questions, and from how the permission checks run on each of those questions. Both are fixable in code — a bigger instance is not needed yet.

## What the numbers show

Over the measured period the top offenders were all repeat background checks:

| What is being checked | Times asked | Avg time | Total time |
|---|---|---|---|
| Support conversations (4 variants of the same check) | ~1.75 million | 14–44 ms | ~5.9 hours |
| Support messages | ~400,000 | 2–61 ms | ~1.7 hours |
| Unresolved failed payments | ~187,000 | 18 ms | ~0.9 hours |
| Today's classes / check-ins / café orders | ~1.2 million | 1–6 ms | ~1.0 hour |

The conversations table holds only 699 rows. A question against 699 rows should take well under a millisecond, not 14–44 ms. That gap is the real problem.

## Root causes

1. **Permission rules are re-run for every row.** The rules on conversations, messages, check-ins and payment attempts call `auth.uid()` and the role lookup directly, so Postgres re-runs them once per row instead of once per request. With several overlapping rules on the same table, the work multiplies.
2. **Overlapping duplicate rules.** Conversations, messages and check-ins each have both a broad "staff can manage" rule and a separate "staff can view" rule. Every one is evaluated and OR-ed together on each read.
3. **Screens poll every 15 seconds, even in background tabs.** Support notifications, café notifications and the attendance board each refetch on their own 15-second timer with background refetching on. Front desk, kiosk and admin machines left open all day produce this volume continuously, and several screens ask for overlapping data separately.
4. **Counting rows unnecessarily.** Several checks request an exact total count alongside the rows, which forces a second pass over the table on every poll.

## Changes to make

**Database (migration)**

- Rewrite the permission rules on `email_conversations`, `email_messages`, `check_ins` and `payment_attempts` to wrap the identity and role calls in a scalar subquery (`(select auth.uid())`, `(select has_any_role(...))`) so they are evaluated once per request. Same access, same people, far less work.
- Collapse the duplicate staff rules per table into one rule per action, preserving exactly the current roles.
- Add `idx_email_conversations_status_last_message` on `(status, last_message_at desc)` and `idx_email_messages_sender_created` on `(sender_type, created_at desc)` to back the ordered reads.

**App code**

- `useAdminSupportNotifications` and `useAdminCafeNotifications`: raise the interval from 15 s to 60 s, and turn off background refetching so hidden tabs stop polling. Live updates still arrive instantly through the existing realtime subscriptions; polling is only the safety net.
- `useUnifiedAttendance`: raise its 15 s timer to 60 s and skip the fetch while the page is hidden.
- Drop the exact-count requests on the notification checks — they only need whether anything is waiting, not a total.

**No behaviour change:** the chime, badges and order alerts still fire the moment something arrives, because realtime remains the primary path.

## Expected effect

The polling changes cut request volume by roughly 75%, and the permission rewrite cuts the per-request cost of the heaviest checks by an order of magnitude. Together that should remove the large majority of current database CPU. Re-measure afterwards; if memory still sits high under real traffic, resizing is then a justified next step rather than a guess.

## Risk

Permission rule edits touch who can read support conversations, messages, check-ins and payment records. The migration preserves the exact same role lists and ownership conditions; only the evaluation shape changes. Worth a quick post-deploy check as a front-desk user and as a member.
