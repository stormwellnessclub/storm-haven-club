## Goal

When a member cancels a class, don't drop them from the roster. Keep their row visible (greyed out) with a badge:

- **Early Cancel** — cancelled 24+ hours before class start (no charge, credit refunded)
- **Late Cancel** — cancelled within 24 hours of class start (credit/pass forfeited — charge window)

## Scope

Admin/kiosk class roster only. No change to member portal, no change to cancellation charge logic, no change to emails/SMS/push.

## Changes

### 1. `src/hooks/useRosterIdentity.ts`
- Extend the `class_bookings` select to include `status`, `cancelled_at`, and `class_sessions(session_date, start_time)`.
- Widen the status filter from `["confirmed","completed","no_show"]` to also include `"cancelled"`.
- Add fields to `RosterAttendee`:
  - `isCancelled: boolean`
  - `cancelType: "early" | "late" | null` — computed from `cancelled_at` vs `session_date + start_time` (< 24h before start = `late`, else `early`). Null when not cancelled.
  - `cancelledAt: string | null`
- Same treatment for `resolveAttendeePreviewsForSessions` is NOT needed (day-view preview should stay showing active attendees only) — leave it filtered to `confirmed`/`completed`.

### 2. `src/pages/admin/ClassRoster.tsx`
- Attendee count / capacity chip: exclude `isCancelled` from the confirmed count (currently `attendees.filter(a => !a.isNoShow).length`). Change to `!a.isNoShow && !a.isCancelled`.
- Sort cancelled rows to the bottom of the list (below active + no-show), after the existing admin-hold sort.
- Render for cancelled rows:
  - Row wrapper gets `opacity-60` and muted background (e.g. `bg-muted/30`).
  - Show name, contact, and type as usual (greyed).
  - Status column shows a badge: `Early Cancel` (secondary/outline) or `Late Cancel` (destructive outline) with a small timestamp tooltip (`Cancelled {relative time}`).
  - Hide action buttons (check-in, no-show, move, remove, undo no-show) — cancelled is terminal on the roster.

### 3. Any place that consumes `RosterAttendee` and counts seats
- Search for `.isNoShow` usages in the roster/kiosk components and make sure new `isCancelled` rows aren't double-counted toward capacity or "remaining" tallies. Likely touched files: `ClassRoster.tsx` (already listed), and any kiosk class page that reuses `resolveRosterIdentities`.

## Out of scope

- No DB migration — `status = 'cancelled'` and `cancelled_at` already exist.
- No change to `cancel_class_booking` RPC or refund policy.
- No change to the member-facing cancel confirmation flow.
- No change to waitlist promotion behavior on cancel.

## Verification

1. Book a class as a test member, cancel it >24h before start → roster shows the row greyed out with **Early Cancel** badge; capacity count drops by 1.
2. Book a class starting in <24h, cancel it → roster shows row greyed with **Late Cancel** badge.
3. Confirm cancelled rows have no action buttons and are sorted to the bottom.
4. Confirm confirmed-attendee count and "remaining" (for bulk no-show) exclude cancelled rows.
