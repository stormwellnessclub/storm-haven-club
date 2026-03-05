

# Fix: Engagement Nudge Showing Inactive Full-Schedule Classes

## Problem
The engagement nudge on the member portal recommends classes from the **full schedule** that isn't live yet. The `useEngagementNudge` hook queries all `class_sessions` without filtering to only the active soft-launch class types (`Signature Flow`, `Reformer Flow`, `Reformer Sculpt`).

## Fix
In `src/hooks/useEngagementNudge.ts`, filter the "next available session" query (line 67-78) to only include sessions whose class type name is in the soft-launch list. This ensures the nudge only surfaces bookable classes.

### Change
**File: `src/hooks/useEngagementNudge.ts`**
- Import `SOFT_LAUNCH_CLASS_NAMES` from `@/lib/softLaunchSchedule`
- Add `.in("class_types.name", SOFT_LAUNCH_CLASS_NAMES)` to the next-session query
- Also filter the "most-booked class type" logic to only consider soft-launch class types, so the favorite type ID itself comes from an active class

This is a single-file, ~5-line change.

