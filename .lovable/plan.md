## Goal
1. Create tomorrow's 12:00 PM Signature Flow Pilates – All Levels session with instructor "Sub".
2. Add per-attendee "Move to another session" action on the class roster that preserves the class credit.
3. Confirm cancel-and-refund already works on the roster (it does).

## Details

### A. Data changes (via insert tool, not schema)
- Create instructor row: `first_name = 'Sub'`, `last_name = ''`, `email = 'sub@stormwellnessclub.com'`, `is_active = true`. (Rename later in Admin → Instructors.)
- Create `class_sessions` row:
  - `class_type_id` = `Signature Flow Pilates – All Levels` (`8d29b6d1-1b37-4bca-aa7d-13aca36b8059`)
  - `session_date` = `2026-07-04`, `start_time` = `12:00`, `end_time` = `12:50`
  - `room` = `Reformer Studio`, `max_capacity` = `8`
  - `instructor_id` = the Sub instructor's id

### B. New RPC (migration) — `move_class_booking(p_booking_id uuid, p_target_session_id uuid)`
- `SECURITY DEFINER`, `set search_path = public`, admin-only via `has_any_role(auth.uid(), ARRAY['admin','super_admin','front_desk'])`.
- Validates: target session exists, not cancelled, in the future, has capacity.
- `UPDATE class_bookings SET session_id = target, updated_at = now() WHERE id = booking_id AND status = 'confirmed'` — same booking row, same credit/pass, no refund+rebook.
- Recomputes `current_enrollment` on both source and target sessions from `class_bookings`.
- Inserts `admin_action_log` row (`action_type = 'moved_class_booking'`, before/after JSON).

### C. Roster UI — `src/pages/admin/ClassRoster.tsx`
- Add a Move (arrow-right-left) icon button on each attendee row, next to the existing Remove/No-show/Undo actions.
- Clicking opens `MoveBookingDialog` listing other **future, non-cancelled** sessions of the same class type with remaining capacity (soonest first). Includes a "Show all class types" toggle for flexibility.
- On confirm: call `move_class_booking`, then best-effort `send-email` custom_message to the member ("Your class was moved to …") with Reply-To `admin@stormwellnessclub.com`.
- Toast: "Moved to {date} {time} — credit kept, member notified".

### D. Cancel & refund
No changes — the existing `removeMutation` on the roster already cancels the booking, refunds the class credit or class pass, releases the waitlist hold, and emails the member.

## Files touched
- Migration: `move_class_booking` RPC.
- Data insert: Sub instructor + Saturday 12 PM session.
- Edited: `src/pages/admin/ClassRoster.tsx` — add Move button and wire dialog.
- New: `src/components/admin/roster/MoveBookingDialog.tsx`.

## Open question
The existing roster already has Remove (refunds credit) and, for checked-in attendees, "Undo check-in and refund". Should I leave these as-is, or add a single unified "Cancel & refund credit" button on every attendee row regardless of status?