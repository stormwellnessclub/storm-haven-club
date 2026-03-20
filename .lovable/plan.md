

## Schedule Conflict Detector

### Problem
When managing class schedules, you have to manually check each class type to spot instructor overlaps, room double-bookings, or time conflicts. There's no cross-class-type conflict view.

### Solution
Add a "Conflicts" alert panel to the Class Schedules page that automatically scans all active schedules and surfaces three types of conflicts:

1. **Instructor overlap** — Same instructor assigned to two classes at overlapping times on the same day
2. **Room/studio double-booking** — Same room assigned to two classes at overlapping times on the same day
3. **Identical slot** — Two different class types scheduled at the exact same day/time/room

### Changes

#### 1. Add conflict detection logic to `src/pages/admin/ClassSchedules.tsx`
- After fetching all schedules, run a client-side conflict scan (no new DB query needed — all data is already loaded)
- Compare every pair of active schedules on the same `day_of_week` for time overlaps
- Flag conflicts by type: `instructor_overlap`, `room_conflict`, `time_conflict`
- Display a collapsible alert card at the top of the page showing all detected conflicts with details (which classes, which day, which times, which instructor/room)
- Each conflict links to the relevant schedules for quick editing

#### 2. Conflict detection function (pure TypeScript utility)
- `detectScheduleConflicts(schedules)` returns an array of conflict objects
- Time overlap check: two slots overlap if `startA < endB && startB < endA`
- Only checks `is_active` schedules
- Groups conflicts by severity: instructor overlaps first, then room conflicts

#### 3. UI presentation
- If no conflicts: green "No conflicts detected" badge
- If conflicts exist: amber/red alert card with count badge, expandable list
- Each conflict row shows: day, times, class names, instructor/room involved, and an "Edit" button to jump to the schedule entry

### Technical Details
- Pure client-side — no DB migration needed, no new queries
- Uses the existing `schedules` query that already joins `class_types` and `instructors`
- Conflict check runs on every data fetch (lightweight — typically <50 schedules)

