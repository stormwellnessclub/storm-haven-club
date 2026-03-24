

# Fix Class Management: Complete Audit and Fix Plan

## Every Issue Found (Thorough Audit)

### Issue 1: Race condition — reconciliation fires after mutation is "done"
**File**: `src/pages/admin/ClassSchedules.tsx` lines 234-246
The schedule save mutation calls `reconcile_and_generate_class_sessions` inside `onSuccess` as a fire-and-forget `.then()`. This means:
- The toast says "Schedule updated — sessions reconciled" before reconciliation actually finishes
- Query invalidation happens inside the `.then()` callback, but React Query already sees the mutation as settled
- If the user navigates away or the page re-renders, the reconciliation may not complete
- The UI may show stale session data because invalidation fires before the RPC returns

**Fix**: Move the RPC call into the `mutationFn` itself (await it), then invalidate in `onSuccess`. This guarantees sessions are synced before the UI updates.

### Issue 2: Active data conflict — Monday 9 AM has two overlapping classes in the same room
**Live data**: `Reformer Sculpt` and `Reformer Sculpt – Adv/Int (Heated)` are both active schedules at Monday 9:00-9:50 in Reformer Studio. Both are generating visible sessions. This produces overlapping calendar blocks that stack on top of each other.

The conflict detection system (`checkNewScheduleConflicts`) should catch this on save, but it was likely created before the conflict check existed. The conflict panel does detect it visually, but the classes already exist and are generating sessions.

**Fix**: This is a data issue that the admin needs to resolve (deactivate one). But the calendar needs to render overlaps readably regardless.

### Issue 3: Calendar views render overlapping blocks directly on top of each other
**Files**: `WeeklyCalendarView.tsx` and `AdminSessionsCalendar.tsx`
Both calendars position all blocks at `left: 0.5, right: 0.5` — when two classes overlap in time, they stack invisibly on the same position. There is no column-splitting algorithm.

**Fix**: Implement overlap detection and horizontal sub-column layout (like Google Calendar). Each overlapping group gets divided into side-by-side columns.

### Issue 4: Classes "Today" page is locked to today only
**File**: `src/pages/admin/Classes.tsx`
The list view hardcodes `session_date = today`. Staff cannot browse tomorrow, next week, or any other day in the list view. The Week Calendar tab has navigation but the Today tab does not.

**Fix**: Add date navigation (prev/next day + date picker) to the list view so staff can browse any day's classes.

### Issue 5: No way to delete a schedule
**File**: `src/pages/admin/ClassSchedules.tsx`
There is no delete action for schedules — only edit and the Active toggle inside the edit dialog. Admins who want to remove a schedule entirely have no way to do it. Inactive schedules still clutter the list/calendar.

**Fix**: Add a delete button in the edit dialog with confirmation. On delete, trigger reconciliation to hide/cancel orphaned future sessions.

### Issue 6: Wednesday and Thursday "Signature Flow" schedules have 0 visible sessions
Active schedules `Signature Flow` on Wed 11:00 and Thu 9:00 have 0 generated visible sessions, meaning the reconciliation ran before these schedules were created or the generation window didn't cover them. The cron job or manual reconciliation should have caught them.

**Fix**: After fixing the mutation flow (Issue 1), run a reconciliation to generate missing sessions for these schedules.

### Issue 7: `useClassSessions.ts` hook is imported but never called
The hook in `src/hooks/useClassSessions.ts` is only imported for its `ClassSession` type. The actual queries in `Schedule.tsx`, `Classes.tsx`, and `AdminSessionsCalendar.tsx` all write their own inline queries. This means there's no shared query logic — each page could drift.

**Fix**: Not blocking, but note for future cleanup. The Schedule.tsx page writes its own query that matches the hook's filters, so they're consistent currently.

### Issue 8: The `upcoming-sessions-count` query doesn't filter `is_hidden`
**File**: `src/pages/admin/ClassSchedules.tsx` line 159-165
The stats card counts upcoming sessions with `is_cancelled = false` but does NOT filter `is_hidden = false`. So the count includes hidden sessions, making the number misleading.

**Fix**: Add `.eq("is_hidden", false)` to the count query.

---

## Implementation Plan

### 1. Fix the mutation race condition
Move the `reconcile_and_generate_class_sessions` RPC call into the `mutationFn` (awaited) in `ClassSchedules.tsx`. Keep query invalidation in `onSuccess`.

### 2. Add overlap column layout to both calendar views
Implement a `computeOverlapColumns()` utility that:
- Groups overlapping blocks by time range within each day
- Assigns each block a column index and total column count
- Returns `left` and `width` percentages for each block

Apply to both `WeeklyCalendarView.tsx` and `AdminSessionsCalendar.tsx`.

### 3. Add date navigation to Classes page
Replace the "Today" hardcoded query in `Classes.tsx` with a date-aware query. Add prev/next day buttons, a date picker, and a "Today" reset button.

### 4. Add schedule delete capability
Add a delete button in the schedule edit dialog in `ClassSchedules.tsx`. On delete:
- Remove the `class_schedules` row
- Run reconciliation to hide orphaned future sessions
- Invalidate all session queries

### 5. Fix the upcoming sessions count filter
Add `is_hidden = false` to the count query in `ClassSchedules.tsx`.

### 6. Trigger data reconciliation
After the code changes, the user should click "Reconcile & Generate Sessions" to regenerate missing sessions for the Wed/Thu Signature Flow schedules that currently have 0 visible sessions.

---

## Files to change
- `src/pages/admin/ClassSchedules.tsx` — fix mutation, add delete, fix count query
- `src/components/admin/WeeklyCalendarView.tsx` — overlap column layout
- `src/components/admin/AdminSessionsCalendar.tsx` — overlap column layout
- `src/pages/admin/Classes.tsx` — date navigation

## Result
- Schedule changes immediately and reliably propagate to generated sessions
- Overlapping classes display side-by-side in all calendar views
- Staff can browse any day's classes, not just today
- Schedules can be deleted (not just deactivated)
- Session counts are accurate
- Missing sessions will generate on next reconciliation

