# Fix false "room already booked" and phantom double-booking warnings

## What's actually wrong

Conflict detection only compares weekday + time + room. It completely ignores each schedule's date window (`effective_from` / `effective_until`) and whether an entry is a one-off. So two classes that can never happen on the same day are still flagged.

Confirmed in the live schedule data — every current "duplicate" is a pair of an August schedule and its September replacement:

```text
Sunday   11:00-11:50  Reformer Studio   Aug 2-31  vs  Sep 6-30
Tuesday  19:00-19:50  Reformer Studio   Jul 21-Aug 31 vs Sep 1-30
Thursday 11:00-11:50  Aerobics Studio   Jul 29-Aug 31 vs Sep 2-30
Thursday 12:00-12:50  Reformer Studio   Jul 29-Aug 31 vs Sep 2-30
```

None of those overlap in time. They are false alarms.

Same root cause blocks the Friday one-off: the live warning box under the form runs on every mode (the mode check only exists on save), and it matches any active Friday schedule in that room regardless of date — including a one-off dated a different Friday and expired August rules.

## The fix

1. Make every conflict check date-aware. Two schedules only conflict if their active date windows actually overlap, treating a null window as open-ended and a one-off as a single day. Expired schedules (end date already in the past) are excluded entirely.
2. For one-off entries, compare against the specific date only — a one-off on Friday Sep 4 is never compared to a one-off on Friday Sep 11.
3. Show the date window in the warning text, so a real conflict reads like "Aerobics Studio is already booked for Mat Pilates on Fri Sep 4" rather than a generic weekday statement.
4. Apply the same date filter to the conflict panel at the bottom of Class Schedules, so the count reflects real overlaps only. With this fix the current 4 clusters should drop to zero.
5. Keep the pre-save block as-is in behaviour (only hard-stops ongoing rules), but let it use the corrected logic so it stops firing on stale matches.

No schedule data is changed — this is detection logic only.

## Technical notes

- `src/lib/scheduleConflicts.ts`: extend `ScheduleForConflict` with `effective_from`, `effective_until`, `is_one_time`; add a `windowsOverlap()` helper and an `isExpired()` filter used by `analyzeScheduleConflicts`, `detectScheduleConflicts`, and `checkNewScheduleConflicts`. Cluster key gains the date window so identical weekly rules in different months don't cluster.
- `src/pages/admin/ClassSchedules.tsx`: pass the resolved `effective_from` / `effective_until` / `is_one_time` of the form state into `checkNewScheduleConflicts` (currently omitted), and ensure the schedules query selects those columns.
- Verify afterwards by re-rendering the panel against current data: expected result is "No scheduling conflicts detected", and adding a Friday Sep 4 Mat Pilates in Aerobics Studio at a free time saves without a warning.
