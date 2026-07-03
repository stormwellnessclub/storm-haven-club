## Goal

Add "Invite-Only" classes for new teachers: free for members, admin-managed roster, with a per-session toggle to hide from or show on the public schedule.

## How it works

Each session gets two independent switches in the admin UI:

- **Invite-only** — booking bypasses credit/pass deduction (free for members). Only staff can add attendees; members cannot self-book. Non-members are blocked.
- **Hidden from schedule** — controls whether the session appears on the public `/schedule` and member/portal browsers. Reuses the existing `is_hidden` column.

The two toggles are independent, so you can:

| Invite-only | Hidden | Result                                                     |
| ----------- | ------ | ---------------------------------------------------------- |
| ✅          | ✅     | Silent test class. Only staff-added members see it.        |
| ✅          | ❌     | Publicly visible but marked "Invite Only" — no self-book.  |
| ❌          | ✅     | Regular class, unlisted (existing behavior).               |
| ❌          | ❌     | Normal public class.                                       |

## Changes

### Database (one migration)

1. Add `is_invite_only boolean not null default false` to `class_sessions`.
2. Add same column to `class_schedules` so recurring "trial teacher" schedules propagate the flag to generated sessions.
3. Update `process-session-generation` logic / session insert to copy the flag from schedule → session.
4. Update `create_atomic_class_booking` RPC:
   - If `is_invite_only = true` and caller is a member with active benefits → skip credit/pass consumption, mark booking `payment_method = 'invite'`, still enforce capacity + not-frozen + not-blocked.
   - If caller is not staff and session is invite-only + hidden → reject (cannot self-book invisible class).
5. Update the admin "add attendee to roster" RPC to allow adding to invite-only sessions without touching credits.

### Admin UI

- **Session edit dialog** (`AdminClasses` / today's sessions + `ClassSchedules` recurring editor): add two switches — "Invite only (free for members)" and "Hide from public schedule".
- **Roster view**: show an "Invite Only" badge; the existing "Add attendee" flow works as-is once the RPC allows it. Members added here consume no credits.

### Member/public UI

- `ScheduleBrowser` / `useClassSessions`: keep the existing `is_hidden` filter. For visible invite-only sessions, render an "Invite Only" pill and disable the Book button with a tooltip ("This class is invite only — contact the front desk").
- No changes to purchase/credits flow — invite bookings never touch balances.

## Files touched

- Migration: `class_sessions`, `class_schedules`, `create_atomic_class_booking`, admin add-attendee RPC.
- `supabase/functions/process-session-generation/*` — propagate `is_invite_only`.
- `src/hooks/useClassSessions.ts` — select new column.
- `src/components/booking/ScheduleBrowser.tsx` + booking button — invite-only badge & disabled self-book.
- Admin session/schedule editors — two new switches.
- Roster component — "Invite Only" badge.

## Out of scope

- Named invite lists / email invites. You add attendees manually from the roster.
- Non-member invite pricing (invite-only = members only, free).
