## Goal
Cap the public/member/portal class schedule (and booking) view at **4 weeks out from today**. When someone tries to page past that horizon, show a friendly message explaining sessions are released in 4-week increments.

## Where
Single file: `src/components/booking/ScheduleBrowser.tsx` (used by `/schedule`, `/portal/book/class`, `/member/book/class`).

## Changes

1. **Cap forward navigation**
   - Compute `maxWeekStart = startOfWeek(addWeeks(today, 3))` — this makes the 4th week (weeks 0–3) the furthest browsable week.
   - Disable the "next week" button when `weekStart >= maxWeekStart`.
   - Same cap applied to the date picker (block dates past `addWeeks(today, 4) - 1 day`).

2. **Horizon message**
   - When user is on the last allowed week (`weekStart === maxWeekStart`), render an info banner under the week nav:
     > "You've reached the end of the current schedule. New classes are released in 4-week increments — check back soon for the next block of dates."
   - Style: muted card / `Alert` with `Info` icon, matches existing schedule styling.

3. **No backend / no session-generation changes.** The reconciler already generates 4 weeks ahead, so this just tightens what the UI exposes.

## Out of scope
- Admin schedule views (they keep full range).
- Session generation cadence.
- Copy variants — one message, one location.
