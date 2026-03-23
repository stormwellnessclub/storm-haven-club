

## Fix Class Schedule: Remove Temp Schedule, Show Only Active Classes with Times, Create Proper Schedule Page

### What's Wrong

1. **No `/schedule` route exists** — dozens of links across the app point to `/schedule` (member bookings, portal, credits page, etc.) but it's not registered in `App.tsx`, so users hit a 404.

2. **`/classes` page is a catalog, not a schedule** — it shows class *types* (name, duration, description) without dates or times. The "Book Class" button navigates to `/book` which also doesn't exist → 404.

3. **TempClassSchedule still exists** — `TempClassSchedule.tsx`, `useTempClassBooking.ts`, `SoftLaunchClassManagement.tsx`, `softLaunchSchedule.ts`, `ensureTempClassSession.ts`, and `SoftLaunchHoursBanner.tsx` are all leftover soft-launch code that should be removed.

4. **Deactivated classes may still appear** — the `TempClassSchedule` query (used by the soft-launch admin) doesn't filter `class_types.is_active`.

### Plan

#### 1. Create `/schedule` page with a proper weekly class schedule (read-only for now)
- New file: `src/pages/Schedule.tsx`
- Shows a weekly calendar grid (like the existing `ClassCalendar` component pattern) pulling from `class_sessions` joined with `class_types` and `instructors`
- Filters: `is_cancelled = false`, `class_types.is_active = true`
- Displays: class name, time, instructor, duration, spots remaining
- Week navigation (prev/next week arrows)
- **No booking buttons yet** — just "Coming Soon" or no action buttons, since you want to verify the schedule first before going live
- Category filter tabs (All, Reformer Pilates, Cycling, Aerobics)

#### 2. Register routes in `App.tsx`
- Add `/schedule` route → new Schedule page
- Add `/book` as alias → same Schedule page (so Classes page button works)

#### 3. Fix `/classes` page
- Change the "Book Class" button to navigate to `/schedule` instead of `/book`

#### 4. Remove all temp/soft-launch schedule code
- Delete `src/components/booking/TempClassSchedule.tsx`
- Delete `src/hooks/useTempClassBooking.ts`
- Delete `src/components/admin/SoftLaunchClassManagement.tsx`
- Delete `src/lib/softLaunchSchedule.ts`
- Delete `src/lib/ensureTempClassSession.ts`
- Delete `src/components/member/SoftLaunchHoursBanner.tsx`
- Remove `SoftLaunchHoursBanner` import/usage from `src/components/member/MemberLayout.tsx`
- Clean up any remaining imports of these deleted files

#### 5. Clean up admin
- Remove TempClassSchedule reference from `SoftLaunchClassManagement` (file is being deleted)
- Check `ClassRosterDialog.tsx` for `softLaunchSchedule` import and update if needed

### Files to create
- `src/pages/Schedule.tsx` — weekly schedule page showing real `class_sessions` data

### Files to modify
- `src/App.tsx` — add `/schedule` and `/book` routes
- `src/pages/Classes.tsx` — change navigate path from `/book` to `/schedule`
- `src/components/member/MemberLayout.tsx` — remove SoftLaunchHoursBanner

### Files to delete
- `src/components/booking/TempClassSchedule.tsx`
- `src/hooks/useTempClassBooking.ts`
- `src/components/admin/SoftLaunchClassManagement.tsx`
- `src/lib/softLaunchSchedule.ts`
- `src/lib/ensureTempClassSession.ts`
- `src/components/member/SoftLaunchHoursBanner.tsx`

### What you'll see after this
- `/schedule` shows a clean weekly calendar with only your **active** classes, their real times, instructors, and spots
- No booking buttons yet (you verify the schedule is correct first, then tell me to make it live)
- All soft-launch/temp code is gone
- No more 404 errors on `/schedule` or `/book`

