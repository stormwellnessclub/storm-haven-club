# Staff Portal — Finish the Last Three Pieces

The portal at `/schedule` already has Today, the week Schedule builder (drag to move, hold Shift to duplicate, copy last week forward, draft vs. published), Team, Coverage rules, Time off, and Hours & cost. This finishes the three remaining items.

## 1. Repeating weekly shifts per person

- New "Repeating shifts" panel inside Team: for a person, add rows like "Mon 9:00–2:00, Front desk" and it repeats every week.
- Set a start date and an optional end date so a pattern can stop when someone changes hours.
- In the Schedule builder, repeating shifts appear as light "suggested" blocks on any week that has nothing scheduled yet. A "Fill week from repeating shifts" button turns them into real draft shifts, skipping days already scheduled or blocked by approved time off.
- Editing or deleting one filled-in shift only changes that week; the pattern stays.

## 2. Day timeline view

- A Day / Week toggle at the top of the Schedule page.
- Day view shows hours down the page with each person's block placed on the time axis, colored by department, so overlapping coverage is visible hour by hour.
- Coverage gaps for that day (from the coverage rules) show as red bands on the timeline.
- Click an empty spot to add a shift at that time, click a block to edit — same editor as the week grid.
- Department filter and draft/published styling carry over from the week view.

## 3. Printable / exportable pay-room sheet

- On Hours & cost: "Print sheet" and "Download CSV".
- Printed sheet: date range, one line per person with department(s), scheduled hours, rate, cost, overtime flag over 40 hours in a week, plus department subtotals and a grand total, on a clean page with the Storm heading.
- Dollar figures only print for super admin, admin and manager accounts; other roles get the same sheet with hours only, enforced by the existing database rule, not just hidden on screen.
- CSV mirrors the printed columns for spreadsheet use.

## Technical notes

- Reuse `staff_shift_templates` for the repeating patterns (it already has day-of-week, times and person link); add nullable `department`, `starts_on`, `ends_on` columns if missing, with GRANTs unchanged. New RPC `apply_schedule_templates_week(p_week_start)` inserts draft shifts, skipping duplicates and approved time off.
- New components: `src/components/schedule/RepeatingShiftsPanel.tsx`, `src/components/schedule/ScheduleDayTimeline.tsx`, `src/components/schedule/HoursPrintSheet.tsx`; wire the Day/Week toggle into `src/pages/schedule/ScheduleBuilder.tsx` and the export buttons into `src/pages/schedule/ScheduleHours.tsx`.
- Timeline reuses `src/lib/schedule/coverage.ts` gap logic and `departments.ts` colors; all dates in `America/Detroit`.
- Print via a print-only stylesheet block rather than a PDF dependency; CSV built client-side.
