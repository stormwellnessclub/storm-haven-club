# Staff Scheduling Portal

A dedicated scheduling portal for all non-instructor staff — front desk, kids care, cafe, and Storm's assistant/floater — built the way tools like When I Work, 7shifts, Homebase and Deputy work: one week grid, drag-to-copy shifts, repeating templates, coverage warnings, and hours/labor totals. Managers and admins only for now; staff do not log in.

## What you get

**Its own portal at `/schedule`** — separate shell, its own sidebar and top bar, not buried inside the admin pages. Sign in with the same manager/admin account. Everything below is done inside it.

Sections:

1. **Today** — live coverage board. Each department in a column with who is on, who is coming next, uncovered blocks flagged in red, today's open time-off requests, and a "who called off" quick action.
2. **Schedule** — the builder.
   - Week grid: staff down the side, days across, colored blocks by department.
   - Click an empty cell to add, click a block to edit, drag a block to move it to another day or person, hold and drag to duplicate.
   - Copy last week forward (skips anything already scheduled), clear a week, and repeating weekly templates per person.
   - Day timeline view showing overlapping coverage hour by hour.
   - Filter by department; a person with mixed roles appears once but their shifts are colored per department.
   - Draft vs. published: build the week, then hit Publish so it is clear what staff have been told.
3. **Team** — the staff directory. Add a person (no login required), set their name, contact, which departments they can work (multiple allowed), their default weekly availability, and their hourly rate. Archive people who leave.
4. **Coverage rules** — minimum staffing per department per day and time block (e.g. front desk needs 2 people 9:00–14:00, kids care 1 person 9:00–12:00). Any gap shows red on the grid and on Today.
5. **Time off** — requests and manager-entered days off; approved time off blocks scheduling and shows on the grid.
6. **Hours & cost** — per person and per department: scheduled hours this week/pay period, projected cost, overtime flags over 40 hours, and a printable/exportable pay-room sheet.

**Pay rates are manager-only.** Rates and any dollar figure are visible to super admin, admin and manager accounts only — front desk and other staff roles never see them, enforced in the database, not just hidden in the screen.

## Technical notes

New tables (all with GRANTs, RLS, and manager-only write):

- `staff_schedule_profiles` — one row per schedulable person (links to `auth.users` or `staff_placeholders`), `departments text[]`, active flag, default availability, color. Readable by scheduling roles.
- `staff_pay_rates` — `person_key`, `hourly_rate`, effective dates. SELECT/INSERT/UPDATE restricted to `has_any_role(..., ['super_admin','admin','manager'])`; front desk excluded.
- `staff_coverage_rules` — department, day_of_week, start/end time, `min_staff`, active.

Additive columns on existing tables (no drops/renames): `staff_shifts.department`, `break_minutes`, `published_at`; `staff_shift_templates.department`. Existing `position` stays and is backfilled into `department` where it maps.

RPCs: `schedule_week_summary(start_date)` (hours per person/department + coverage gaps), `schedule_labor_cost(start_date, end_date)` (manager-role guarded, returns cost), `publish_schedule_week(start_date)`, `copy_schedule_week(from_date, to_date)` (duplicate-safe).

Frontend: new `src/pages/schedule/*` portal with its own `ScheduleShell` layout and routes under `/schedule` in `src/App.tsx`; reuse and extend the existing week grid, day timeline, shift dialog, template manager and time-off panel components from `src/components/admin/staff-schedule/` rather than rewriting them. Drag and drop via the pointer-event pattern already used in Class Studio. All dates handled in `America/Detroit`. The old `/admin/staff-schedule` page redirects into the new portal.
