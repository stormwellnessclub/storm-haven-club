## Goal

Let admins undo a No Show in two ways: an immediate toast "Undo" right after the action, and a persistent button on any No Show row in the roster.

## Why this works

Both per-row and bulk No Show only ever flip `confirmed → no_show` (the buttons are gated on `!isCheckedIn && !isNoShow`). So "undo" is unambiguous: set the booking(s) back to `confirmed`. No credit/pass changes needed — they were never refunded.

## Changes — `src/pages/admin/ClassRoster.tsx`

### 1. New `undoNoShowMutation`
Accepts a single bookingId or an array. Runs:
```
UPDATE class_bookings SET status='confirmed', updated_at=now() WHERE id IN (...)
```
Invalidates roster on success. Toast: "Restored — back to Registered."

### 2. Toast undo after marking
Use sonner's `action` prop on the success toast:
- Per-row: `toast.success("Marked as no-show — credit/pass kept", { action: { label: "Undo", onClick: () => undoNoShowMutation.mutate([bookingId]) } })`
- Bulk: same pattern, passing the full array of just-marked IDs back.

The toast button stays visible until the toast dismisses (~5s default), giving the admin a quick "oops" recovery without hunting for the row.

### 3. Persistent "Undo No Show" button on No Show rows
In the roster actions cell, when `attendee.isNoShow` is true, render a single ghost button:
- Icon: `RotateCcw` (lucide), label tooltip "Undo No Show — restore to Registered".
- Click → `undoNoShowMutation.mutate([attendee.bookingId])`.

The existing Check In / No Show / Trash buttons remain hidden for no-show rows; only Undo shows. Once undone, the row re-renders with the normal Registered actions.

## Out of scope

- No undo for the Remove/Refund Trash button (that one already credits/refunds and emails — different flow, different plan if you want it).
- No time limit on the persistent undo — admins can undo any No Show row anytime until the booking is otherwise resolved.

## Technical notes

- Pure UI + one mutation; no schema or RPC changes.
- Auto-heal `current_enrollment` already excludes no-show rows, so undoing will naturally bump the count back up on the next roster fetch.
