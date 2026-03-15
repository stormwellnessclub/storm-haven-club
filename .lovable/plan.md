
## What’s actually happening (root cause)

From the code and backend data, the canceled Saturday sessions are already marked correctly (`is_cancelled = true`, `is_hidden = true`).  
So this is not a cancellation write issue — it’s a display logic issue.

Your booking UI (`TempClassSchedule`) is built from a hardcoded timetable first (`getClassesForDate`), then it *tries* to overlay DB state. If that overlay misses for any reason (timing/name mismatch, stale fetch window), the hardcoded class still renders and shows “Sign In to Book.”

Also, “class is done” is only handled at the **day** level (`day.isPast`), not at the **time slot** level, so earlier classes on today can still show.

---

## Plan to fix

### 1) Make slot visibility time-aware (remove completed classes)
Update `src/components/booking/TempClassSchedule.tsx`:
- Add per-slot end-time calculation (`date + class start time + 50 min`).
- If slot end time is in the past and `showHistory` is false, hide that slot.
- Keep history behavior for admin/reference view (`showHistory` true).

### 2) Make cancellation matching robust (stop ghost classes)
In `TempClassSchedule`:
- Replace fragile `find`-by-class-name matching with a deterministic slot key map using date + start_time.
- Use DB state as authoritative for cancellation/hide flags when a session exists for that slot.
- Continue default capacities when no DB session exists, but never show canceled/hidden slot if DB indicates it.

### 3) Prevent empty “ghost columns”
In daily rendering:
- Pre-filter visible slots before rendering.
- If all slots are hidden (past/canceled/removed), render “No classes” instead of blank space.

### 4) Make updates immediate after admin cancel/remove
Add realtime invalidation for the booking schedule query:
- Subscribe to `class_sessions` changes and invalidate `temp-schedule-enrollment` query on updates/inserts/deletes.
- Keep existing polling fallback as backup.
- Add DB migration to enable realtime publication for `public.class_sessions` if not already enabled.

### 5) Keep behavior consistent across schedule surfaces
Apply the same “ended class” exclusion rule to the non-temp/full schedule path (`useClassSessions` / full schedule tab), so users never see classes that already finished today.

---

## Files to change

- `src/components/booking/TempClassSchedule.tsx` (core fix)
- `src/hooks/useClassSessions.ts` (same-day finished class filtering)
- New migration in `supabase/migrations/*` to enable realtime on `class_sessions` (if needed)

---

## Validation checklist (end-to-end)

1. Cancel Saturday 8:00 PM and 9:00 PM in admin with “Remove from schedule” and confirm they disappear on public/member schedule immediately.
2. Let a class time pass on the current day and confirm it auto-disappears without waiting for date rollover.
3. Verify admin/reference history mode still shows canceled/removed classes for operational review.
4. Verify booking buttons still appear only for valid future, active slots.

---

## Technical notes

- Current behavior comes from the “hardcoded timetable + optional DB overlay” architecture.
- The cancellation data is present in backend, but frontend fallback currently allows stale/default slot rendering.
- This plan keeps your existing soft-launch model (no full rewrite), while making visibility deterministic and real-time-aware.
