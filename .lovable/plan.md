

## Fix Kids Care Booking Submission Error

### Root Cause
The duration validation in `src/hooks/useKidsCareBooking.ts` (line 148) uses `differenceInHours()` from date-fns, which returns **whole hours only** (truncates). So:
- A 30-minute session → returns `0` → fails the `durationHours <= 0` check → throws error
- A 90-minute session → returns `1` → passes, but is incorrect

This means most booking attempts (especially 30-min or 1.5-hour sessions) silently fail with the generic "Kids care sessions must be between 1 minute and 2 hours" error.

Additionally, `child_age` is an `integer` column in the database, but the code passes a float (e.g., `2.7`), which could cause a type mismatch error on insert.

### Fix

**File: `src/hooks/useKidsCareBooking.ts`**

1. **Replace `differenceInHours` with minute-based math** for duration validation:
   - Calculate duration in minutes using `differenceInMinutes(endTimeObj, startTimeObj)`
   - Validate: `durationMinutes > 0 && durationMinutes <= 120`

2. **Round `child_age` to integer** before inserting:
   - `child_age: Math.round(params.childAge)` to match the `integer` column type

These are two small changes — no structural or UI modifications needed.

### Expected Result
Booking submissions with any valid duration (30 min, 1 hour, 1.5 hours, 2 hours) will succeed without error.

