## Problem

Two blockers in the class roster / class management flow:

1. **Can't credit back checked-in people.** On the roster, once an attendee shows the green "Checked In" badge, the Remove / refund button disappears entirely (`src/pages/admin/ClassRoster.tsx` line 1353 — the whole action group is gated by `!attendee.isCheckedIn`). So there's no way to undo a check-in and return a credit/pass.

2. **Can't cancel a class once it's started or finished.** On `src/pages/admin/Classes.tsx` line 420, the "Cancel" button only renders when `status === 'upcoming'`. In-progress and completed sessions hide it. The underlying RPC `admin_cancel_class_session` also only loops over bookings with `status = 'confirmed'` — checked-in bookings (`status = 'completed'`) are skipped, so even if we exposed the button, those members would not get their credit/pass restored.

## Changes

### 1. Roster — refund + remove a checked-in attendee
`src/pages/admin/ClassRoster.tsx`

- Always show the destructive Trash button (no longer gated by `!isCheckedIn`).
- For checked-in (completed) rows, the button opens a confirm dialog: "Undo check-in and refund this attendee? Their credit/pass will be returned." On confirm, run the existing `removeMutation` logic — it already restores credits (`member_credits.credits_remaining`) and passes (`class_passes.classes_remaining`) and flips the booking to `cancelled` regardless of whether it was `confirmed` or `completed`. No mutation logic changes needed; just remove the UI gate and add the confirm step for already-checked-in rows.
- Toast: "Check-in undone — credit/pass restored."

### 2. Classes list — allow cancel at any time
`src/pages/admin/Classes.tsx`

- Remove the `status === 'upcoming'` condition around the Cancel button. Show it for `upcoming`, `in-progress`, and `completed` sessions (still hidden when already cancelled).
- When the session is `in-progress` or `completed`, the existing cancel dialog gets an extra warning line: "This class has already started/ended. Attendees who were checked in will also be refunded and notified."

### 3. RPC — refund completed bookings too
New migration updating `admin_cancel_class_session`:

- Change the loop's `WHERE` from `status = 'confirmed'` to `status IN ('confirmed', 'completed')` so checked-in attendees also get credits/passes restored.
- Keep everything else identical (notification filter in `Classes.tsx` already uses `cancellation_reason = 'Class cancelled by admin'`, which still matches).

### 4. Email filter still correct
`Classes.tsx` already fetches bookings where `cancellation_reason = 'Class cancelled by admin'` AND `status = 'cancelled'` to send the cancellation email — completed-then-cancelled bookings will now be in that set and will receive the email, which is the desired behaviour.

## Technical notes

- No new tables, no new policies, no new email templates.
- `removeMutation` already handles credit/pass restoration symmetrically — the only reason it wasn't reachable for checked-in rows was the UI gate.
- The RPC change is a single `WHERE` edit; safe to run.
- We don't auto-refund Stripe drop-in charges (current behaviour) — only credits and passes. Drop-in/cash refunds remain a manual Stripe refund, same as today.

## Out of scope

- Refunding Stripe drop-in charges automatically.
- A bulk "refund everyone" button on the roster (use Cancel Class for that).
- Changing how `current_enrollment` is computed.
