

# Update Temp Class Schedule with Actual Times

## Overview
Replace the placeholder "TBA" schedule in `TempClassSchedule.tsx` with the actual Reformer Pilates soft launch schedule running **February 20 -- March 18, 2026**.

## Schedule Breakdown

| Day | Classes |
|-----|---------|
| Sunday | No classes |
| Monday -- Thursday | 9:00 AM Signature Flow, 10:00 AM Reformer Flow |
| Friday | 9:00 AM Signature Flow, 10:00 AM Reformer Flow, 8:00 PM Signature Flow, 9:00 PM Reformer Flow |
| Saturday | 10:00 AM Signature Flow, 11:00 AM Reformer Sculpt, 8:00 PM Signature Flow, 9:00 PM Reformer Flow |

- All classes: **50 minutes**, Instructor: **Duha**
- Date range banner: **Feb 20 -- Mar 18, 2026**

## Changes

### File: `src/components/booking/TempClassSchedule.tsx`
- Replace the `TEMP_SCHEDULE` array with the actual days, times, and class names
- Each entry will show the class name alongside its time (e.g., "9:00 AM -- Signature Flow")
- Remove Sunday or show it as "No classes scheduled"
- Add a date range note at the top: "February 20 -- March 18, 2026"
- Add "50 min" duration indicator per class
- Update the header to say "Reformer Pilates -- Soft Launch Schedule" (already there)
- Use color-coded badges to distinguish class types (Signature Flow vs Reformer Flow vs Reformer Sculpt)

No other files need to change.

