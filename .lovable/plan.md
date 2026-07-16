## Problem

When you add a class in **Recurring** mode it works, but "One-time" doesn't behave right. Looking at the code + database, there are three separate issues that combine into "only recurring works":

1. **Calendar view (default) hides the type** — `WeeklyCalendarView` renders every schedule by `day_of_week` with no badge or date. A one-time entry saves fine but looks identical to a weekly recurring class in its day column, with no date shown, so it appears "not added" or "just another recurring one."
2. **No calendar tile for a one-time class on the actual date** — because the calendar is a generic weekly grid, a class scheduled only for e.g. Fri 7/17/26 is drawn on every Friday column visually, which is misleading.
3. **Silent save failures aren't surfaced** — the "For a period" / "One-time" branches skip the conflict-warning path, but if the underlying insert throws (e.g., invalid time, missing class type), the toast fires but the dialog stays open with no inline error, so it feels like nothing happened.

There are no unique constraints or RLS rules blocking one-time inserts, and `reconcile_and_generate_class_sessions` already respects `effective_from` / `effective_until`, so sessions ARE being created — they're just invisible on the admin calendar.

## Plan

### 1. `src/components/admin/WeeklyCalendarView.tsx`
- Extend the `ClassSchedule` prop type with `is_one_time`, `effective_from`, `effective_until`.
- On each schedule tile, add a small badge row:
  - `One-time · Jul 17` when `is_one_time` is true
  - `Thru Aug 15` when only `effective_until` is set
  - `From Jul 20` when only `effective_from` is set
  - `Jul 20 – Aug 15` for full window
- Visually dim the tile in weeks where the current calendar week is outside its effective window (optional, subtle opacity).
- Keep click-to-edit behavior unchanged.

### 2. `src/pages/admin/ClassSchedules.tsx`
- Default `viewMode` to `"table"` when the query returns any `is_one_time`/dated schedules on first load, so users can clearly see them listed with the existing badges (lines 829-841 already render these correctly in table mode).
- In the dialog: show a small inline error region (red text) inside the form when the mutation `onError` fires, in addition to the toast, so validation failures don't feel silent.
- When user picks **One-time**, auto-uncheck "Active" toggle? No — leave `is_active=true` (needed for reconcile to pick it up).
- Immediately after save, call the existing `reconcile_and_generate_class_sessions` (already done) AND invalidate `['admin-sessions-calendar']` + `['class-schedules']` so the list refreshes without a page reload.

### 3. Verification pass
- After changes, insert a test one-time schedule for a near-future date via the UI, confirm:
  - It appears in the **Table view** with the "One-time · <date>" badge.
  - It appears in the **Calendar view** with the same badge inside the tile.
  - A row lands in `class_sessions` for that exact date via the reconcile RPC.

### Out of scope
- No DB schema changes — columns already exist.
- No changes to member-facing `ScheduleBrowser` (one-time sessions already flow through `class_sessions` and render correctly there).
- No reconcile RPC changes.

## Files touched
- `src/components/admin/WeeklyCalendarView.tsx` — add badge + prop type
- `src/pages/admin/ClassSchedules.tsx` — default view, inline error, cache invalidation
