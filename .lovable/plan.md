

## Fix: Isolate Soft Launch from Permanent Schedule

### The Problem
The permanent class schedule generator pre-created database sessions (e.g., "Signature Flow Pilates - All Levels" at 8:00 AM) that are not supposed to be live yet. These show up in the admin "Full Schedule" tab with incorrect enrollment counts, creating confusion. The enrollment data queries also don't filter by soft-launch class names, which risks cross-contamination between the two systems.

### What Will Change

**1. Filter enrollment queries to soft-launch classes only**

Both `TempClassSchedule.tsx` and `SoftLaunchClassManagement.tsx` query ALL `class_sessions` for a date range. This means permanent schedule sessions (like "Signature Flow Pilates - All Levels") can accidentally match soft-launch entries via the loose `includes` name check.

Fix: Add a filter to both enrollment queries so they only fetch sessions whose class type name exactly matches the soft-launch class names ("Signature Flow", "Reformer Flow", "Reformer Sculpt"). This is done by adding `.in('class_types.name', SOFT_LAUNCH_CLASS_NAMES)` to the queries.

**2. Use exact name matching instead of `includes`**

The current merge logic does `typeName?.includes(entry.name)` which means "Signature Flow Pilates - All Levels" would match "Signature Flow". Change to exact equality: `typeName === entry.name`.

**3. Hide the admin Full Schedule tab during soft launch**

The "Full Schedule" admin tab pulls ALL sessions from the database for today, including pre-generated permanent schedule classes that are not supposed to be active. Replace the full schedule content with a "Coming Soon" placeholder (matching the public schedule page pattern) so admins don't see phantom classes.

**4. Fix phantom enrollment data**

The permanent schedule session "Signature Flow Pilates - All Levels" at 8:00 AM on Feb 21 shows `current_enrollment: 2` but only has 1 actual confirmed booking. Reset this counter to match reality.

### Technical Details

| File | Change |
|------|--------|
| `src/components/booking/TempClassSchedule.tsx` | Filter enrollment query with `.in('class_types.name', SOFT_LAUNCH_CLASS_NAMES)`. Change `typeName?.includes(className)` to `typeName === className` in `getEnrollmentForSlot`. |
| `src/components/admin/SoftLaunchClassManagement.tsx` | Filter DB sessions query with `.in('class_types.name', SOFT_LAUNCH_CLASS_NAMES)`. Change `typeName?.includes(entry.name)` to `typeName === entry.name` in merge logic. |
| `src/pages/admin/Classes.tsx` | Replace the full-schedule tab content with a "Coming Soon" placeholder during soft launch, removing the live session list that shows permanent schedule data. |
| `src/lib/softLaunchSchedule.ts` | Export `SOFT_LAUNCH_CLASS_NAMES` (already exported, just confirming it's used). |
| Database | Fix `current_enrollment` on the mismatched session (2 to 1). |

