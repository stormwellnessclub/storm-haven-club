# Fix Kids Care hours saving multiple times

## What's wrong
When you save a day's Kids Care hours, the system is supposed to erase that day's old hours and then add the new ones. The erase step silently does nothing, so every save stacks another copy on top. Right now there are duplicates on Sept 22 (10 AM x6, 12 PM x4), Sept 23 (x3), Sept 29 (x4), Oct 1 (x2) and Oct 2 (x2).

## Fix
1. Make saving a day's hours a single all-or-nothing step on the server: replace that day's hours exactly with what you entered. Same for "Copy to other dates".
2. Block exact duplicates (same date, same start and end time) from ever being stored.
3. Clean up the existing duplicates, keeping one copy of each. Any kids care bookings already made stay untouched.
4. Grey out the Save button while it's saving so a double-click can't send it twice.

## Technical notes
- Cause: `kids_care_hour_slots` has DELETE/UPDATE/INSERT policies but no SELECT policy; Postgres RLS only deletes rows visible via SELECT, so `.delete().eq("slot_date", …)` in `useSaveKidsCareHourSlots` / `useCopyKidsCareHourSlots` affects 0 rows, then the insert appends.
- Migration: SECURITY DEFINER RPC `replace_kids_care_hour_slots(p_date date, p_slots jsonb)` and `copy_kids_care_hour_slots(p_source date, p_targets date[])`, guarded by `has_any_role(... super_admin, admin, manager, childcare_staff)`, delete+insert in one transaction, `SET search_path = public`. Dedupe existing rows (keep earliest `created_at`, check bookings don't reference slot ids first), then add unique index on `(slot_date, open_time, close_time)`.
- Hooks switch to the RPCs; save/copy buttons use `isPending` to disable.
