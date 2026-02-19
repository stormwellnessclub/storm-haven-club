

## Updated Temp Class Schedule

### Changes to `src/components/booking/TempClassSchedule.tsx`

**1. Class size: 12 spots to 8 spots**

**2. Replace static schedule with date-aware `getClassesForDate(date)` function**

| Day | Classes | Available From |
|-----|---------|----------------|
| **Feb 20 (Fri)** | 8 PM Signature Flow, 9 PM Reformer Flow (evening only) | Feb 20 |
| **Feb 21 (Sat)** | 8 PM Signature Flow, 9 PM Reformer Sculpt (evening only) | Feb 21 |
| **Feb 22 (Sun)** | No classes | -- |
| **Mon-Thu** | 9 AM Signature Flow, 10 AM Reformer Flow | Feb 23 |
| **Fridays** | 9 AM Signature Flow, 10 AM Reformer Flow + 8 PM Signature Flow, 9 PM Reformer Flow | Feb 27 (morning), Feb 20 (evening) |
| **Saturdays** | 8 PM Signature Flow, 9 PM Reformer Sculpt | Feb 21 onward |
| **Sundays** | 10 AM Signature Flow, 11 AM Reformer Sculpt | Mar 1 onward |

Key rules in the function:

- **Friday evening** available from Feb 20 onward (every Friday)
- **Saturday evening** available from Feb 21 onward (every Saturday)
- **Mon-Fri morning** (9 AM + 10 AM) available from Feb 23 onward
- **Sunday morning** (10 AM + 11 AM) available from Mar 1 onward
- No Saturday mornings at all
- All dates must be within Feb 20 - Mar 18 range

This means starting Feb 23, weekday evenings (Fri) keep running alongside the new morning classes. Saturday keeps its evening slot every week. Sunday adds mornings starting Mar 1.

### Technical approach

Replace the `SCHEDULE_BY_DOW` record with a `getClassesForDate(date: Date)` function that builds an array of classes by checking the day-of-week and whether the date is on/after the relevant start date. Update the day column generator to call this function. Update "12 spots" to "8 spots" in `TempClassCard`.

