
## The Problem

The `TempClassSchedule` component exists and is correctly placed in the "Class Schedule" tab. The full schedule calendar already has `bookingDisabled={true}`. **Nothing is broken in the page structure.**

The real issue is in `TempClassSchedule.tsx` — the `getClassesForDate` function uses `date-fns` `isBefore` and `isAfter` to compare dates. Because these functions compare full timestamps (including time), a `new Date(2026, 1, 20)` (Feb 20 at midnight local time) can appear to be "before" today's date if compared at the wrong moment, or vice versa — causing columns to show "No classes" when they should show classes.

Additionally, the default `weekOffset` starts at `1` (the Feb 23 week). Since today is Feb 20 (a Friday), the user lands on the Feb 23 week and doesn't see today's Friday evening classes which are in the week at offset `0`.

### Fixes

**Fix 1 — Correct the date range check in `TempClassSchedule.tsx`**

Replace `isBefore`/`isAfter` timestamp comparisons with a safer date-only comparison using `getFullYear()`, `getMonth()`, `getDate()`. This eliminates timezone/time-of-day edge cases that make Feb 20 appear out of range.

```ts
// Replace this:
if (isBefore(date, SOFT_LAUNCH_START) || isAfter(date, SOFT_LAUNCH_END)) return [];

// With date-only comparison:
function toDateOnly(d: Date) {
  return d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
}
const dateNum = toDateOnly(date);
if (dateNum < toDateOnly(SOFT_LAUNCH_START) || dateNum > toDateOnly(SOFT_LAUNCH_END)) return [];
```

Apply the same fix to `MORNING_START` and `SUNDAY_MORNING_START` checks.

**Fix 2 — Default to the current week (offset 0) so today's classes are visible**

Change the initial `weekOffset` state from `1` to `0` so when someone visits /schedule today (Feb 20), they immediately see this week's classes including Friday evening.

```ts
// Change from:
const [weekOffset, setWeekOffset] = useState(1);
// To:
const [weekOffset, setWeekOffset] = useState(0);
```

**Fix 3 — Confirm Full Schedule tab remains view-only**

The `Schedule.tsx` already passes `bookingDisabled={true}` to `ClassCalendar`. No change needed there — just confirming this is already in place and will not be touched.

### Files to Change

| File | Change |
|------|--------|
| `src/components/booking/TempClassSchedule.tsx` | Fix date comparison logic to use date-only integers; default week offset to 0 |

No changes to `Schedule.tsx` — the tab structure and `bookingDisabled` prop are already correct.
