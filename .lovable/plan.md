## What happened

Nothing was deleted or cancelled — sessions were **hidden** by the schedule reconcile job that ran when you were editing schedules tonight.

The reconcile function (`reconcile_and_generate_class_sessions`) marks a session `is_hidden = true` whenever its parent `class_schedule` gets deactivated. It does **not** check whether members are already booked into that session. When you edited/replaced schedules earlier, the old parent schedules were deactivated and the future sessions attached to them were silently hidden — including ones with confirmed bookings.

Confirmed data (verified in the DB just now):

| Date | Time | Class | Confirmed bookings | State |
|---|---|---|---|---|
| Sun 7/26 | 11:00 AM | Reformer Sculpt – Adv/Int (Heated) | 2 | hidden (not cancelled) |
| Sat 7/25 | 12:00 PM | Full Body Strength | 2 | hidden (not cancelled) |
| Mon 8/3 | 10:00 AM | Reformer Sculpt – Adv/Int (Heated) | 8 | hidden (not cancelled) |

The bookings themselves are intact — the sessions just stopped showing on the public schedule and the roster.

## Fix

**1. Restore the 3 sessions right now**
Set `is_hidden = false` on those three session IDs so they reappear on the schedule and roster. No booking data changes — the 2/2/8 confirmed bookings are already attached.

**2. Sweep for anything else affected**
Run one query across all future sessions where `is_hidden = true` AND at least one confirmed booking exists, and unhide every match. (Current sweep shows only the 3 above, but re-check at fix time.)

**3. Patch `reconcile_and_generate_class_sessions` so this can't happen again**
Change the "hide orphaned sessions" step to exclude any session that has confirmed bookings. Those sessions stay visible and keep their roster; admin can still cancel them explicitly if needed. Add the same guard to the "class type deactivated" branch.

Concretely, the hide step becomes:

```sql
UPDATE class_sessions cs
SET is_hidden = true, updated_at = now()
WHERE cs.session_date >= _start_date
  AND cs.is_cancelled = false
  AND cs.is_hidden = false
  AND cs.schedule_id IS NOT NULL
  AND (
    EXISTS (SELECT 1 FROM class_schedules s WHERE s.id = cs.schedule_id AND s.is_active = false)
    OR EXISTS (SELECT 1 FROM class_types ct WHERE ct.id = cs.class_type_id AND ct.is_active = false)
  )
  AND NOT EXISTS (
    SELECT 1 FROM class_bookings cb
    WHERE cb.session_id = cs.id AND cb.status = 'confirmed'
  );
```

**4. One-line admin note (no UI change requested)**
When you deactivate a schedule that has future sessions with bookings, we leave those sessions visible so the roster is preserved — cancel them individually if you actually want to remove them.

## Technical details

- Migration: add the `NOT EXISTS (confirmed bookings)` guard to both hide-branches in `public.reconcile_and_generate_class_sessions`.
- Data fix (same migration): `UPDATE class_sessions SET is_hidden = false, updated_at = now() WHERE session_date >= CURRENT_DATE AND is_hidden = true AND is_cancelled = false AND EXISTS (SELECT 1 FROM class_bookings cb WHERE cb.session_id = class_sessions.id AND cb.status = 'confirmed');`
- No code changes to the schedule browser, roster, or booking hooks — they already filter on `is_hidden = false`, so unhiding is sufficient.
- Enrollment counts on the 3 sessions already match confirmed bookings (2/2/8), so no recount needed.
