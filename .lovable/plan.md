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
- A coverage dial: 30% covered / 70% uncovered
- Horizontal bars per department: needed vs scheduled
- A 7-day bar chart of uncovered hours per day, so the worst days are obvious
- A headcount chart: on staff now vs needed, per department

A week selector lets you look at any week; everything recalculates.

## Part 2 — What's needed to close the gap

- Hours to add per department, and the number of 4–6 hour shifts that represents
- Hires needed per department (minimum and comfortable), with a "hire this first" order based on where the gap is deepest
- A hiring runway: at 2, 4 and 6 hires a month, how many months to fully staffed
- Weekly and annual payroll to fully staff, priced from published US Bureau of Labor Statistics wages rather than guesses — receptionist median $17.23/hr, food and beverage serving median $14.92/hr, childcare worker median $15.41/hr (BLS, 2023–2024). Rates remain editable, but each field shows the BLS figure it starts from.

## Part 3 — Year-one business impact, evidence-based

No invented churn rate. Every impact figure is either measured from your own data or drawn from a cited industry source shown on the page next to the number, with the source name, year and link. Where the industry has no hard data, the page says so plainly instead of estimating.

**Measured from your own numbers (no assumptions):**
- Uncovered hours per week, and cumulative uncovered hours over the 9 months open
- The payroll value of those hours at BLS wage rates — what the gap would have cost to staff properly, and therefore the labour you have personally absorbed
- Hours per week you are on the floor instead of on growth work, and what that totals across 9 months
- Hours the cafe cannot take orders and kids care cannot run, per week and cumulatively

**Benchmarked against published industry data (each cited on the page):**
- **Retention baseline** — US clubs retain 66.4% of members a year; roughly one in three leave (Health & Fitness Association, 2025 Fitness Industry Benchmarking Report). Independent clubs that rely on personal, staffed service retain better than chains: 73.2% vs 62.3% (IHRSA Profiles of Success, 2019). Average membership length 20.2 months (IHRSA "One Million Strong", Bedford, 2015).
- **Revenue per member** — $582/year at fitness-only clubs, $842/year at multipurpose clubs (IHRSA Profiles of Success, 2019). The page uses these to price retention, rather than an invented member value; your own average dues can be entered to replace it.
- **Ancillary revenue actually at stake** — published club revenue mix: food and beverage 3.9%, spa 4.3%, children and youth programs 1.9%, personal training 7.7% of total club revenue (IHRSA Profiles of Success, 2019/2020). The page applies these shares to the hours those departments are unstaffed, and labels the result as a modelled forfeit, noting no study measures closed-amenity loss directly.
- **Childcare demand** — 34% of parents say they would use the gym more if childcare were available (IHRSA survey, widely cited). Shown against your 83% uncovered kids-care hours.
- **First-year failure** — 81% of fitness studios fail in their first year, with undercapitalisation and owner overload among the named causes (Health & Fitness Association, 2018). This is the single most relevant stat for the partner conversation.
- **Founder load** — small business owners average 52 hours a week, 26% of self-employed work 60+; 87% of founders report anxiety, depression or burnout (Gallup 2005/2009; The Lonely Entrepreneur survey via Fortune, 2025). Your measured floor hours are plotted against these benchmarks.
- **Cost of turnover** — replacing an employee costs 50–200% of annual salary; average cost per hire around $4,700 (Gallup; SHRM). Used to show what burning out the few people you do have would cost.
- **Service quality** — the rigorous evidence here is from hospitality, not fitness: staff-driven service quality and online reviews measurably affect hotel occupancy and revenue (Phillips, Barnes, Zigan & Schegg, Journal of Travel Research, 2016, 442 hotels). The page cites it as an analogy and states plainly that no fitness-specific study of understaffing and reviews exists.

**The partner chart:** a 12-month projection with three lines — staying as-is, hiring slowly, hiring to plan — showing cumulative uncovered hours and their payroll-equivalent cost compounding month over month. Built from measured hours only; the retention and revenue benchmarks appear as annotated reference bands, not as forecast lines, so nothing in the projection rests on an assumed churn figure.

**A sources panel** at the bottom listing every citation with organisation, year and link, plus an honest "what we can't measure" note covering the three gaps the research found: no study links staffed hours directly to churn, no study measures forfeited revenue from closed amenities, and no fitness-specific review/NPS data exists.

Print/PDF and copy-as-text for the partner meeting.

## Technical notes

- New `src/lib/schedule/staffingGap.ts`: pure calculations comparing `buildStaffingPlan()` output to scheduled shift hours — per-department and per-day coverage, percentages, hires needed, payroll at BLS rates, cumulative 9-month totals, 12-month projection scenarios.
- New `src/lib/schedule/industryBenchmarks.ts`: the cited figures above as structured data (value, label, source, year, url, confidence: strong/directional), rendered inline and in the sources panel. Keeping them in one file makes every claim auditable and updatable.
- New page `src/pages/schedule/StaffingGap.tsx` in `ScheduleShell`, route `/schedule/staffing-gap` behind `ProtectedScheduleRoute`, plus a "Staffing gap" nav link next to "Staffing plan".
- Live data via the existing `useScheduleWeek` hook and `shiftHours()` — scheduled shifts only, cancelled and PTO excluded.
- Charts with the project's existing `recharts` setup and the department color tokens in `index.css`; no new dependencies.
- Editable inputs (wage rates, your own average member value, opening date) in local state persisted per browser. No new tables, no writes to `staff_shifts` or `staff_coverage_rules`.
