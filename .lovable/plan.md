

## Schedule Conflict Detector + Calendar View (Completed)

### What was built

#### 1. Pre-save conflict validation
- `checkNewScheduleConflicts()` in `src/lib/scheduleConflicts.ts` checks proposed schedules against all existing active schedules before saving
- Blocks saves that would create instructor overlaps or room double-bookings
- Shows toast error with conflict details

#### 2. Real-time inline warnings in schedule dialog
- As the user fills out day/time/room/instructor fields, conflicts are detected in real-time
- Red warning panel appears inside the dialog listing each conflict before clicking Save

#### 3. Weekly calendar view
- `src/components/admin/WeeklyCalendarView.tsx` — visual 7-column grid (Mon–Sun) with time axis (5 AM–9 PM)
- Classes rendered as colored blocks by category, showing name, instructor, time, room
- Conflicting blocks highlighted with red ring
- Click any block to edit
- Toggle between Calendar and Table views on the admin page

### Files changed
- `src/lib/scheduleConflicts.ts` — added `checkNewScheduleConflicts`
- `src/pages/admin/ClassSchedules.tsx` — pre-save validation, inline warnings, calendar toggle
- `src/components/admin/WeeklyCalendarView.tsx` — new component
