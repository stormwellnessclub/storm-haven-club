

## Fix: Block Schedule Saves That Create Conflicts + Calendar View

### Problem
The conflict detector runs **after** saving — it shows conflicts in a panel but doesn't **prevent** you from saving a conflicting schedule. You can create overlapping classes without any warning.

### Changes

#### 1. Pre-save conflict validation in `ClassSchedules.tsx`
Before the mutation runs, check the proposed schedule against all existing active schedules:
- Build a temporary schedule object from the form values
- Run it through the same overlap logic (`timesOverlap`) against all other active schedules (excluding the one being edited)
- If conflicts found: show a toast error listing each conflict (e.g., "Instructor X is already teaching Y at that time") and **block the save**
- Add a new utility function `checkNewScheduleConflicts(proposed, existingSchedules)` to `scheduleConflicts.ts`

#### 2. Visual warning in the save dialog
- When the user selects a day/time/room/instructor combination that conflicts, show an inline red warning below the form fields in real-time (before they even click Save)
- Use the same conflict check logic, triggered on form field changes

#### 3. Add weekly calendar view (as previously planned)
- New `WeeklyCalendarView.tsx` component: 7-column CSS grid (Mon–Sun), time axis 5 AM–9 PM
- Classes rendered as positioned colored blocks showing name, instructor, time, room
- Conflicting blocks highlighted with red border
- Click block to edit
- Toggle between Table and Calendar views on the page

### Technical Details

**New function in `scheduleConflicts.ts`:**
```typescript
export function checkNewScheduleConflicts(
  proposed: { day_of_week: number; start_time: string; end_time: string; 
              instructor_id: string | null; room: string | null; id?: string },
  existingSchedules: ScheduleForConflict[]
): string[]  // returns array of conflict description strings
```

**Pre-save check in mutation:**
```typescript
const warnings = checkNewScheduleConflicts(
  { ...scheduleData, id: editingSchedule?.id },
  schedules
);
if (warnings.length > 0) {
  toast.error(warnings[0]);
  return; // block save
}
```

**Files to create/modify:**
- `src/lib/scheduleConflicts.ts` — add `checkNewScheduleConflicts`
- `src/pages/admin/ClassSchedules.tsx` — add pre-save validation + inline warnings + calendar toggle
- `src/components/admin/WeeklyCalendarView.tsx` — new calendar grid component

