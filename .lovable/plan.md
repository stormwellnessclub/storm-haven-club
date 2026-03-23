

## Fix: Deactivated Schedules Still Showing Sessions

### Root Cause
When you deactivate a class schedule (e.g., turn off a Bootcamp Glutes time slot), only the `class_schedules` record is updated. The sessions already generated from that schedule (`class_sessions` table) remain with `is_hidden = false` and `is_cancelled = false`. The admin Today's Classes page doesn't check the source schedule's active status.

**Result**: 12 of today's sessions come from deactivated schedules but still appear on the admin page and public schedule.

### Fix (3 parts)

#### 1. Database migration — Clean up existing sessions + add automation
- Set `is_hidden = true` on all **future** `class_sessions` where the linked `class_schedules.is_active = false`
- Create a trigger on `class_schedules`: when `is_active` changes to `false`, automatically set `is_hidden = true` on all future sessions from that schedule. When reactivated (`is_active → true`), set `is_hidden = false` on future sessions.

#### 2. Admin Today's Classes query — filter hidden sessions
- In `src/pages/admin/Classes.tsx`, add `.eq('is_hidden', false)` to the query so hidden sessions don't appear.

#### 3. Admin Today's Classes also shows room info
- The query currently selects `*` from class_sessions which includes `room`, but it's not displayed. Add room display to match what's useful for staff (the screenshot shows room info like "Aerobics 2", "Reformer 3").

### Files to modify
- `src/pages/admin/Classes.tsx` — add `is_hidden = false` filter
- Database migration — bulk-hide sessions from inactive schedules + add trigger

