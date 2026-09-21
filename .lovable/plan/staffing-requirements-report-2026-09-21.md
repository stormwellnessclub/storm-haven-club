# Staffing Requirements Report

A saved report page inside the scheduling portal at **/schedule/staffing-plan**, so you can open it any time and share it with your partners. Numbers only — it does not change the schedule, the team list or the coverage rules.

## The numbers it will show

Operating hours used (front desk 2 people at all times, cafe 1, kids care 1):

| Department | Mon–Thu | Friday | Sat & Sun | Weekly hours |
|---|---|---|---|---|
| Front desk (x2) | 5:30a–12:00a | 5:30a–8:30p | 8:00a–7:30p | **224.0** |
| Cafe | 7:00a–10:00p | 8:00a–7:30p | 8:00a–7:00p | **93.5** |
| Kids care | 9:00a–7:00p | 9:00a–5:00p | 9:00a–3:00p | **60.0** |
| **Total** | | | | **377.5** |

Headcount at 4–6 hour shifts, 3–4 days a week (about 17 hours per person; a few people twice a week at ~10):

- Front desk: **13–15 people** (about 45 shifts a week)
- Cafe: **5–6 people** (about 19 shifts)
- Kids care: **3–4 people** (about 12 shifts)
- **Total: 21–25 people**

The page will also show a day-by-day shift breakdown per department (how many shifts each day and their approximate start/end blocks), so a partner can see where the 377.5 hours come from.

## What the page includes

- Header with the assumptions (shift length 4–6h, 3–4 days max per person) stated plainly at the top
- Department cards with daily hours, weekly totals and shift counts
- A day-by-day table per department
- Headcount summary with the math shown
- Print / PDF button and a copy-as-text button for sharing with partners
- Dated as a saved plan so it is clear which version partners are looking at

## Technical notes

- New file `src/lib/schedule/staffingPlan.ts` holding the operating-hours definition and the hour/shift/headcount calculations, so the report is computed rather than hardcoded and the hours can be edited in one place later.
- New page `src/pages/schedule/StaffingPlan.tsx` rendered inside the existing `ScheduleShell`, route `/schedule/staffing-plan` behind `ProtectedScheduleRoute` in `src/App.tsx`, plus a "Staffing plan" link in the schedule sidebar.
- Print styling via a print-only stylesheet block; no new tables, no database writes, no changes to `staff_coverage_rules`, shifts or team records.
