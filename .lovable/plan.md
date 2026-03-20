

## Fix: Admin Class Calendar Not Showing

### Root Cause Analysis
After reviewing the code, data (16 active schedules exist), RLS policies, and component structure, the `WeeklyCalendarView` component has a layout issue that can make it appear empty or invisible:

1. **The grid is 1088px tall** (`17 hours × 64px`) — it likely extends well below the viewport and may appear blank if there are no classes in the first visible rows (5–8 AM range).
2. **The `min-w-[800px]` inner grid** inside a `CardContent` with `overflow-x-auto` can make it hard to see on smaller screens — the content may be clipped or require scrolling the user doesn't realize exists.
3. **Category colors may not match** — your class types likely use categories like `pilates_cycling` which don't match the hardcoded color map keys (`pilates`, `cycling`), so all blocks get the subtle default color (`bg-primary/10`) that may be near-invisible on certain backgrounds.

### Fix

#### 1. Adjust time range and make calendar more compact
- Change `DAY_START` from 5 AM → 6 AM (or auto-detect from actual schedule data)
- Reduce row height from 64px → 48px to keep the calendar from being excessively tall
- Add a visible border/background to the entire calendar container so it's clear it's rendered

#### 2. Fix category color matching
- Normalize category names: strip `_cycling`, `_reformer` suffixes and match the base word
- Add `pilates_cycling`, `pilates_reformer` etc. to the color map
- Fallback to a more visible default color

#### 3. Improve visibility
- Add a "No classes scheduled before X AM" indicator at top if early hours are empty
- Auto-scroll to the first class of the day
- Add a subtle alternating row background for hour grid lines

### Files to modify
- `src/components/admin/WeeklyCalendarView.tsx` — fix color matching, adjust time range, improve layout visibility

