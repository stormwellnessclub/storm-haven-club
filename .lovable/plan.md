
## Problem

`TempClassSchedule` always initialises `weekOffset` to `0`, which anchors the view to the week of Feb 20 (the soft-launch start). When opened today (Feb 20 or later), the calendar grid renders from Sunday of that week, and the user must scroll right through earlier or "no classes" columns to reach today. There is also no scroll-into-view behaviour on the day column.

## Solution

Two targeted changes to `src/components/booking/TempClassSchedule.tsx`:

### 1. Default `weekOffset` to the current week

Replace the hardcoded `useState(0)` with a computed initial value that finds how many weeks ahead of `baseWeekStart` today falls:

```ts
const baseWeekStart = startOfWeek(SOFT_LAUNCH_START, { weekStartsOn: 0 });

function getInitialWeekOffset() {
  const todayWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  const diff = Math.round(
    (todayWeekStart.getTime() - baseWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );
  // Clamp to [0, totalWeeks]
  return Math.max(0, diff);
}

const [weekOffset, setWeekOffset] = useState(getInitialWeekOffset);
```

This means when the page loads, the week navigator is already on the current week rather than the first soft-launch week.

### 2. Auto-scroll today's column into view

Add a `ref` to the today column and fire `scrollIntoView` on mount:

```ts
import { useRef, useEffect } from "react";

const todayRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  todayRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
}, []);
```

Attach `ref={todayRef}` to the day column `<div>` when `day.isToday` is true. This ensures that on mobile (where columns stack) or on wider grids, the page jumps to the correct position immediately.

## Files to Change

| File | Change |
|------|--------|
| `src/components/booking/TempClassSchedule.tsx` | Default `weekOffset` to current week; add `todayRef` + `useEffect` scroll-into-view |

## No Schema / Backend Changes

This is a pure frontend state and DOM change — no database or edge function changes needed.
