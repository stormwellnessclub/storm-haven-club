# Staffing Gap & Business Impact Report

A new page in the scheduling portal at **/schedule/staffing-gap** that shows, with charts and percentages, how far the club is from the staffing plan today — and what that gap is costing the business in year one. Read-only: it changes no shifts, no team records, no coverage rules.

## Part 1 — Current status (live data)

Pulled from the shifts actually on the schedule for the selected week, compared against the staffing plan (377.5 hours/week).

| Department | Needed | Scheduled this week | Covered | Uncovered |
|---|---|---|---|---|
| Front desk | 224.0 h | 85.5 h | 38% | **138.5 h (62%)** |
| Cafe | 93.5 h | 17.0 h | 18% | **76.5 h (82%)** |
| Kids care | 60.0 h | 10.0 h | 17% | **50.0 h (83%)** |
| **Total** | **377.5 h** | **112.5 h** | **30%** | **265 h (70%)** |

Headcount: 6 people on the schedule against 20–26 needed — 14–20 hires short.

Charts on the page:
- A big coverage dial: 30% covered / 70% uncovered
- Horizontal bars per department: needed vs scheduled
- A 7-day bar chart of uncovered hours per day, so the worst days are obvious
- A headcount chart: on staff now vs needed, per department

A week selector lets you look at any week; everything recalculates.

## Part 2 — What's needed to close the gap

- Hours to add per department, and the number of 4–6 hour shifts that represents
- Hires needed per department (minimum and comfortable), with the "hire this many first" order based on where the gap is deepest
- A hiring runway: at 2, 4 and 6 hires a month, how many months until fully staffed
- Estimated weekly and annual payroll to fully staff, using an hourly rate you can set per department at the top of the page

## Part 3 — Year-one business impact

This is the part for the partners. Every figure is derived from the gap above and from a small set of assumptions shown openly at the top of the page, each one editable so nobody can argue the numbers were hidden.

- **Owner coverage load** — the uncovered 265 hours a week are currently absorbed by you or simply not covered. Shown as hours per week, hours over the 9 months open to date, and the equivalent cost had those hours been staffed at market rate (founder time valued at a rate you set).
- **Founder capacity displaced** — hours a week you are not spending on sales, membership growth and partnerships because you are on the desk, and what that has cost in months of growth work.
- **Cost of the 9-month delay to date** — cumulative uncovered hours and displaced founder hours since opening, stated as one headline figure.
- **Service and revenue exposure** — where hours are missing translated into operational consequences: hours the cafe cannot take orders, kids care sessions that cannot be offered, and hours the desk has fewer than 2 people (tours unhosted, walk-ins unconverted). Each carries a revenue-at-risk estimate from assumptions you set (average cafe ticket, kids care session price, tour-to-join rate, average member value).
- **Member experience and churn risk** — an estimate of memberships at risk from understaffed hours, at a churn assumption you set, priced at annual member value.
- **A 12-month projection chart** with three lines: staying as-is, hiring slowly, and hiring to plan — showing cumulative cost of the gap widening month over month. This is the chart that makes the "waiting costs more" case visually.
- **A plain-language "what this means" summary** written for partners, plus Print/PDF and copy-as-text.

Every impact figure is labelled as an estimate with its assumption shown inline, so it stays honest in a partner meeting.

## Technical notes

- New `src/lib/schedule/staffingGap.ts`: pure calculations comparing `buildStaffingPlan()` output to scheduled shift hours, returning per-department and per-day coverage, percentages, hires needed, and the impact model. All impact assumptions live in one exported `DEFAULT_ASSUMPTIONS` object.
- New page `src/pages/schedule/StaffingGap.tsx` in `ScheduleShell`, route `/schedule/staffing-gap` behind `ProtectedScheduleRoute`, plus a "Staffing gap" nav link next to "Staffing plan".
- Live data via the existing `useScheduleWeek` hook and `shiftHours()` — scheduled shifts only, cancelled and PTO excluded.
- Charts with the project's existing `recharts` setup and the department color tokens already defined in `index.css`; no new dependencies.
- Assumption inputs held in local state (persisted per browser), no new tables, no writes to `staff_shifts` or `staff_coverage_rules`.
