# The cost of a stretched launch — partner brief

A separate one-page brief, built for the conversation with your partners. Not a staffing report: a plain
statement of what opening at partial staffing has already cost, and what every further month adds.

Lives at **Scheduling portal → Cost of waiting** (`/schedule/launch-cost`), print/PDF ready.
The existing Staffing gap report and Staffing plan are untouched.

## Correcting your hours first

The current report assumes 60 floor hours a week. That is wrong and it understates the case.
The brief will use your real numbers, editable at the top of the page:

- Hours at the club: 10-19 a day, default **13 h/day, 7 days** = 91 h/week
- Admin and business side after that: default **3 h/day** = 21 h/week
- Total default: **112 hours a week**, versus a 40-hour job

Both figures are editable so you can set them exactly and the whole page re-prices.

## What the brief shows

### 1. The headline, in one line
Nine months open, still launching. Coverage at 30%. One person absorbing the difference.

### 2. Cost to date — measured, no assumptions
- Uncovered hours since opening and their labour value at federal median wages
- Your hours: total worked, hours beyond a normal full-time week, and what those hours are worth
  if they had been paid at the roles you are covering
- Cafe and kids care: hours the departments sat unstaffed, and the revenue those closed hours
  cannot earn (modelled from the cited industry revenue mix, labelled as modelled)
- Payroll never spent — and set against it, the work that did not get done

### 3. Cost per further month — the number that grows
A single monthly figure: unfilled work + forfeited department revenue + your unpaid overage.
Shown as "every month we wait costs $X" with a 1 / 3 / 6 / 12 month rollforward, so the
delay has a price tag rather than a feeling.

### 4. How far behind a correctly launched club
- Months open versus months fully operating
- Where a club that launched staffed would be at month nine, using the cited benchmarks:
  average retention, average membership length, revenue per member
- Catch-up time at 2, 4 and 6 hires a month — the date the club is actually open as designed

### 5. What partial staffing does to members
Cited industry data only, clearly marked as benchmarks, not predictions:
- 66.4% average annual retention; independents retain 73.2% against chains' 62.3%, specifically
  on staffed personal service
- 34% of parents would use the club more with childcare — kids care is 83% uncovered
- 81% of fitness studios fail in year one
- 87% of founders report burnout; replacing a person costs 50-200% of salary

### 6. Founder risk, stated plainly
112 hours a week is not a staffing strategy. The page states the single-point-of-failure risk:
the club has no coverage if you stop, and names what that would cost in the same dollars as
everything else on the page.

### 7. The ask
Three options priced side by side — stay as we are, hire slowly (2/month), hire to plan (5/month) —
each with its twelve-month cost. Ends with the one sentence for the partners: the cheapest option
on the page is the one we are not doing.

## Technical notes

- New `src/lib/schedule/launchCost.ts` — pure calculation built on the existing `buildGapReport`
  and `staffingPlan`; adds owner-hour valuation, per-month cost of delay, catch-up timeline,
  and the three-option comparison. No new database reads or writes.
- New `src/pages/schedule/LaunchCost.tsx` — brief layout (headline, measured cost cards, monthly
  cost-of-delay chart, catch-up timeline, benchmark cards with citations, three-option table,
  sources panel), Print/PDF and copy-as-text, editable assumptions persisted locally.
- Owner-hour defaults move into shared assumptions so the Staffing gap report picks up the
  corrected 112 h/week instead of 60.
- Route `/schedule/launch-cost` behind `ProtectedScheduleRoute`; nav item added to `ScheduleShell`.
- Every figure is either measured from your own schedule data or carries an on-page citation.
  No churn assumption anywhere.
