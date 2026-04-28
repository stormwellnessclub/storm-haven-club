## Problem

When you cancelled **Buns of Steel** today, two attendees (`lettagj@gmail.com`, `monabeydoun.mb@gmail.com`) showed up because they never received the cancellation email.

## Root Cause

In `src/pages/admin/Classes.tsx` (lines 162–204), after the admin cancel RPC runs, the email blast resolves recipients only via:

```ts
.select('id, member_id, walk_in_email, walk_in_name, members(first_name, last_name, email)')
// recipient = member?.email || walk_in_email
```

Both affected bookings had **`member_id = null`** AND **`walk_in_email = null`** — they were booked through `user_id` (the auth account) with no link to a `members` row. The lookup returned no email, the send was silently skipped, no error logged.

This same gap affects every booking made by a logged-in user whose account isn't tagged with `member_id` (non-members, recently signed-up users, members not yet linked).

## Fix

Rewrite the recipient resolution in `src/pages/admin/Classes.tsx` to walk the **same priority chain the rest of the app uses** for attendee identity (matches `useRosterIdentity` / `resolveAttendeePreviewsForSessions`). For each cancelled booking, resolve email/name in this order:

1. `members.email` (when `member_id` is set)
2. `non_member_profiles.email` (lookup by `user_id`)
3. `profiles.email` (lookup by `user_id` — mirrors auth.users)
4. `walk_in_email`

Implementation steps:

- **Expand the bookings query** to also pull `user_id`.
- **Collect every `user_id`** from bookings that came back without a `members.email`.
- **Batch one query** to `non_member_profiles` (`.in('user_id', userIds)`) and one to `profiles` (`.in('id', userIds)`) to build a `userId → {email, name}` map.
- **Loop and send** `class_cancelled_by_admin` to each resolved email; only skip when truly nothing resolves, and `console.warn` with the booking id so future gaps are visible in logs.
- **Use the same name fallback chain** so the email greeting is correct.

## Files changed

- `src/pages/admin/Classes.tsx` — cancellation email block only.

No DB migrations, no edge function changes, no schema changes. The `send-email` function already handles `class_cancelled_by_admin` correctly — the bug is purely on the client side that decides who to email.

## Verification

After the next admin cancellation, `email_send_log` will show one row per booked attendee (member or `user_id`-only), and the `console.warn` makes any remaining unresolvable bookings visible in browser logs.
