

## Hide Past Dates from Public Schedule, Keep History for Admin

### Problem
Currently the temp class schedule shows all dates from Feb 20 onward, including dates that have already passed. Members see old classes they can no longer book. Admins need to keep seeing the full history.

### Changes

#### 1. TempClassSchedule.tsx -- Hide past dates for non-admin users

- Add an `isPast` check for each day in the weekly grid
- For public/member views (`readOnly=false` or default), past days will be visually dimmed and their class cards will show as "Completed" instead of "Book Class" -- or better, past days simply won't render class cards with booking buttons
- The week navigation will no longer allow navigating to weeks entirely in the past (for public view)
- The initial week offset will always start at the current week (already does this)
- Past day columns will show a subtle "Past" label instead of class cards, keeping the grid layout clean

#### 2. TempClassSchedule.tsx -- Past class handling within the current week

- For the current week, days before today will show classes as non-bookable with a "Completed" or grayed-out state
- Today and future days remain fully interactive with booking buttons

#### 3. Admin view stays unchanged

- The admin classes page (`/admin/classes`) already has its own management view and is not affected
- The `readOnly` prop on TempClassSchedule will be extended: when `readOnly` is true (used on public-facing landing previews), past dates are still hidden
- A new `showHistory` prop (default `false`) can be added if admin needs the full schedule view with past dates

#### 4. Member Bookings page -- already correct

- The member bookings page (`/member/bookings`) already separates "Upcoming" and "Past" tabs using `useUpcomingBookings` and `usePastBookings` hooks -- no changes needed there

### Technical Details

**File: `src/components/booking/TempClassSchedule.tsx`**

- Import `isBefore`, `startOfDay` from date-fns
- In the `weekDays` mapping, add an `isPast` flag: `isPast: isBefore(date, startOfDay(new Date()))`
- In the calendar grid rendering:
  - Past days get `opacity-40` styling and show "Past" text instead of class cards with booking buttons
  - Class cards for past days are hidden (no booking possible)
- Constrain the week navigator's backward button: don't allow navigating to weeks where all 7 days are in the past
- Update `getInitialWeekOffset` to ensure we always land on the current or next valid week

**File: `src/pages/Schedule.tsx`**

- No structural changes needed -- it already wraps `TempClassSchedule` which will self-filter past dates

**Files untouched:**
- `src/pages/admin/Classes.tsx` -- admin view retains full access to all dates
- `src/pages/member/Bookings.tsx` -- already has upcoming/past separation
- `src/lib/softLaunchSchedule.ts` -- schedule definition unchanged

