

## Fix: Admin Can't Navigate to March 18 in Soft Launch Manager

### Root Cause
The date comparison in `SoftLaunchClassManagement.tsx` compares dates with time components. `SOFT_LAUNCH_END` is midnight March 18, but `selectedDate` carries the current time-of-day. When you try to go to March 18, the check `isAfter(March 18 @ current_time, March 18 @ midnight)` returns true, disabling the forward button.

### Fix
**File: `src/components/admin/SoftLaunchClassManagement.tsx`**

Wrap the date comparisons in `startOfDay()` to strip the time component:

```ts
// Line 67-68: change from
const canGoPrev = !isBefore(subDays(selectedDate, 1), SOFT_LAUNCH_START);
const canGoNext = !isAfter(addDays(selectedDate, 1), SOFT_LAUNCH_END);

// to
const canGoPrev = !isBefore(startOfDay(subDays(selectedDate, 1)), SOFT_LAUNCH_START);
const canGoNext = !isAfter(startOfDay(addDays(selectedDate, 1)), SOFT_LAUNCH_END);
```

`startOfDay` is already imported on line 6 (it's from `date-fns`). Wait — actually it's not imported. Need to add it to the import.

Line 6 currently imports: `format, addDays, subDays, isBefore, isAfter`. Add `startOfDay` to that import.

This is a 2-line change plus one import addition.

