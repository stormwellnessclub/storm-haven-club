

# Redesign Temp Class Schedule to Match Regular Class Schedule

## Problems to Fix

1. **Navigation label**: The nav menu says "Schedule" -- should say "Class Schedule"
2. **Tab labels**: "Temp Class Schedule" and "Class Schedule" are confusing and redundant. Rename to "Soft Launch Schedule" and "Full Schedule"
3. **Duplicate banner**: The soft launch banner appears above both tabs. It should only show on the Full Schedule tab (since it explains why booking is disabled there). The temp schedule tab should have its own contextual note
4. **Temp schedule looks nothing like the regular one**: It's a flat list of day-name cards with badge labels. It should use the same weekly calendar grid layout as `ClassCalendar` -- with day columns showing date headers (EEE / day number / month) and individual class cards underneath
5. **Missing class details**: Each class entry should show instructor name, studio/room, duration, and spots info -- just like `ClassCard` does in the regular schedule
6. **Not visually "bookable"**: Should use card-based layout per class (matching `ClassCard` style) with a disabled "Book" button and "Opens soon" note, same as the regular schedule does during soft launch

## Changes

### 1. `src/components/Navigation.tsx` (line 11)
- Change `"Schedule"` to `"Class Schedule"`

### 2. `src/pages/Schedule.tsx`
- Change the page title `<h1>` from "Class Schedule" to "Class Schedule" (already correct)
- Rename tab triggers: "Soft Launch Schedule" and "Full Schedule"
- Move the soft launch banner **inside** the "Full Schedule" tab content only -- not above both tabs
- Add a smaller, cleaner banner inside the Soft Launch tab that says something like "Soft Launch -- Feb 20 to Mar 18, 2026 -- Booking opens soon"

### 3. `src/components/booking/TempClassSchedule.tsx` (major rewrite)
- Replace the current flat day-name grid with a **weekly calendar grid** matching `ClassCalendar` layout:
  - Generate actual dates from Feb 20 to Mar 18 using `date-fns`
  - Show week navigation (prev/next week) with arrows, just like the full schedule
  - Display 7 day columns (Sun--Sat) with date headers showing day name, number, and month
  - Each class renders as a card matching `ClassCard` style: class name, time, duration (50 min), instructor (Duha), studio (Reformer Studio), spots indicator, and a disabled "Book" button with "Opens soon"
- Remove the standalone header with "Instructor: Duha" and the date range banner -- these details now live on each class card and in the tab banner
- Remove the legend badges -- class type info is visible on each card
- Keep the `TEMP_SCHEDULE` data as the source, but map it onto actual calendar dates within the Feb 20 -- Mar 18 window

### No database changes needed.

