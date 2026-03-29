

# Hide Deactivated Classes from Admin Views by Default

## Problem
Deactivated class schedules still show up in admin views, causing confusion:
1. **Class Schedules list view** — shows all schedules with no filter (only the calendar view has a "Hide inactive" toggle)
2. **Daily Sessions view** (`Classes.tsx`) — filters by `class_types.is_active` but doesn't filter out sessions generated from deactivated schedules

## Changes

### 1. ClassSchedules.tsx — Filter inactive from list view too
- Apply the same `hideInactive` toggle to the **list/table view**, not just the calendar
- Move the toggle above both views so it applies regardless of view mode
- Default `hideInactive` to **true** so deactivated schedules are hidden by default (admin can toggle to show them)

### 2. Classes.tsx — Dim or badge deactivated-schedule sessions
- Sessions generated from inactive schedules should either be hidden by default or shown with a clear "Inactive" badge
- Add a toggle similar to the schedules page: "Show inactive" (off by default)
- Query can join on `class_schedules.is_active` or check the session's source schedule status

### Files to edit
- `src/pages/admin/ClassSchedules.tsx` — move toggle above view switcher, apply filter to list view, default to true
- `src/pages/admin/Classes.tsx` — add inactive schedule filtering/indication

