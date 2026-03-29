

# Add Single-Day View to Public Class Schedule

## Overview
Add a date picker alongside the existing weekly view so members can jump to a specific day and see only that day's classes. The weekly view stays as the default; picking a date switches to a focused single-day view with a "Back to week" button.

## Changes

### `src/pages/Schedule.tsx`

1. **Add state**: `selectedDate: Date | null` (null = weekly view, set = single-day view)

2. **Add a date picker button** next to the week navigation controls — a calendar icon button that opens a Popover with the shadcn `<Calendar>` component. When a date is picked, set `selectedDate` to that date. Disable past dates.

3. **When `selectedDate` is set**:
   - Show the day header (e.g. "Wednesday, April 2") with a "Back to week view" button
   - Auto-adjust `weekStart` so the query includes that date (the existing query fetches by week range, so set `weekStart` to `startOfWeek(selectedDate)`)
   - Filter `visibleWeekDays` to only the selected date
   - Everything else (session cards, booking, waitlist counts) works exactly the same since it's the same data, just filtered to one day

4. **"Today" button** — add a small "Today" shortcut button that sets `selectedDate` to today for quick access

5. **Clearing**: clicking "Back to week view" sets `selectedDate` back to `null`

### No other files need changes
The schedule grid rendering already works per-day (it maps over `visibleWeekDays`), so narrowing that array to a single date is all that's needed. No new hooks, no new queries.

