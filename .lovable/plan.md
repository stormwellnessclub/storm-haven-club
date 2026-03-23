

## Fix Three Issues: Member Book Class 404, Schedule Visibility, Admin Deactivated Classes

### Issue 1: Member Portal "Book Class" button → 404
The member dashboard links to `/member/schedule` which doesn't exist as a route.

**Fix**: In `src/pages/member/Dashboard.tsx` line 267, change `/member/schedule` to `/schedule`.

### Issue 2: Public website class schedule shows no times
The `/classes` page is a class type catalog (names, descriptions, duration) — not a live schedule. The actual weekly schedule with dates and times exists at `/schedule` but users may not realize it.

**Fix**: 
- In `src/pages/Classes.tsx`, add a prominent banner/link at the top directing users to `/schedule` for the weekly timetable with times
- Ensure the "Book a Class" button on each class card navigates to `/schedule` (verify current behavior)

### Issue 3: Admin shows deactivated class times
- `src/pages/admin/Classes.tsx` (Today's Classes): Query doesn't filter `is_cancelled = false`, so cancelled sessions still appear
- `src/pages/admin/ClassSchedules.tsx`: Fetches all schedules including `is_active = false` ones in the weekly calendar view — this is intentional for admin management, but the **calendar/grid view** should visually differentiate or optionally hide inactive schedules

**Fix**:
- In `src/pages/admin/Classes.tsx` line 128-130: Add `.eq('is_cancelled', false)` to the query
- In `src/pages/admin/ClassSchedules.tsx`: Add a filter toggle (default ON) to hide inactive schedules from the calendar view, so deactivated time slots don't clutter the display

### Files to modify
- `src/pages/member/Dashboard.tsx` — fix `/member/schedule` → `/schedule`
- `src/pages/Classes.tsx` — add link to `/schedule` for timetable
- `src/pages/admin/Classes.tsx` — filter out cancelled sessions
- `src/pages/admin/ClassSchedules.tsx` — add toggle to hide inactive schedules

