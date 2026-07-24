
## Goal

Turn Class Schedules into a fast, calendar-first workflow: build the schedule by clicking on the calendar (week or month), and jump from any instructor into a filtered view of just their classes.

---

## What you'll be able to do after this

1. **Click any empty time slot on the calendar** → the "Add Class" dialog opens with day-of-week, date, and start time already filled in. You just pick the class + instructor and save.
2. **Toggle between Week / Month views** on the same calendar (currently week only).
   - Month view = compact grid, each day shows class chips (name + time). Click a chip to edit, click an empty day to add a class on that date (auto-selects "one-off" mode).
3. **Click an instructor's name anywhere** (calendar chip, schedules list, roster) → opens an **Instructor detail drawer** showing:
   - Upcoming classes they're booked to teach (next 4 weeks)
   - Recurring schedule they own
   - Roster size per class
   - Buttons: "Add to a class" (opens Add dialog with instructor pre-filled) and "Block time off" (opens their availability override form)
4. **Drag a class chip to another day/time** on the week view to reschedule it (single-session move, does not affect the recurring rule).
5. **"Copy last week" button** on the week view: duplicates last week's schedule into the current view as a starting point, so you don't rebuild from scratch.

---

## Efficiency wins I'm adding on top

- **Templates**: a "Recent classes" strip above the calendar with your last 5 added classes. Click one → new Add dialog pre-filled with that class + instructor + duration.
- **Bulk add**: shift-click multiple empty slots, then hit "Add these" to create the same class across all selected slots in one submit.
- **Conflict indicators**: any slot that would create a room/instructor collision shows a red outline before you save, not after.
- **Compact keyboard shortcuts**: `N` = new schedule, `W`/`M` = week/month, `T` = today, `←`/`→` = prev/next.
- **Instructor color coding**: each instructor gets a stable color so you can spot gaps and imbalance at a glance.

---

## Plan of work

### Step 1 — Month view

- Add a `viewGranularity: "week" | "month"` toggle to `WeeklyCalendarView.tsx` (rename to `ScheduleCalendarView`).
- Month grid = 6 rows × 7 cols with the current month; each cell lists up to 3 class chips + "+N more" overflow.
- Empty-day click → prefills date, opens Add dialog in "one-off" mode.
- Empty-slot click on week view → prefills day + time, opens Add dialog in "ongoing weekly" mode by default (with a quick switch to one-off).

### Step 2 — Click-to-add with prefill

- Extend the existing Add Class dialog in `src/pages/admin/ClassSchedules.tsx` to accept optional `{ prefill: { date?, time?, dayOfWeek?, instructorId? } }` so the calendar can drive it.
- Add a new "Copy last week" button on the week header.

### Step 3 — Instructor detail drawer

- New component `src/components/admin/InstructorScheduleDrawer.tsx` (side sheet, not a full page — stays within the Schedules workflow).
- Data: instructor row + their upcoming `class_sessions` (next 28 days) + owned `class_schedules` + booking counts.
- Actions: **Add class with this instructor**, **Block time off**, **Open full profile**.
- Wire the instructor name in: WeeklyCalendarView chips, ClassSchedules table, ClassRoster header.

### Step 4 — Drag-to-reschedule (week view only)

- Uses `dnd-kit` (already in the project). Dragging a chip to a new cell:
  - Updates only that single `class_sessions` row (`session_date`, `start_time`, `end_time`).
  - Does not touch `class_schedules` (the recurring rule).
  - Confirms with a toast "Moved Reformer Sculpt to Wed 10am — Undo".

### Step 5 — Small quality-of-life

- Recent classes strip (localStorage-persisted last 5).
- Instructor color palette (deterministic hash → tailwind token).
- Keyboard shortcuts hook.
- Bulk-add is optional — I'll build it only if the calendar-first flow feels like it still needs it after Steps 1–3.

---

## Technical notes

- All calendar interactions stay client-side; only the save mutations hit the DB.
- Reuse existing `checkNewScheduleConflicts` for the red outline preview.
- Month view fetches only sessions in the visible month (single query, indexed on `session_date`).
- Instructor drawer uses one RPC-free query joining `class_sessions → class_types` filtered by `instructor_id` + date range — no new tables needed.
- Drag-and-drop moves are session-scoped, so recurring rules stay clean.

---

## Two things to confirm before I build

1. **Drag-to-reschedule scope** — move a **single occurrence** only (recommended), or should dragging also offer "move this and all future occurrences" like Google Calendar? Single-occurrence is faster; the recurring-rule change can stay on the schedule edit form.
2. **Bulk add (Step 5)** — build it now, or wait to see if we need it after using the click-to-add flow for a week?
