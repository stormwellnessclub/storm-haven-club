
Fix the class schedule drift by making every admin schedule-edit path reconcile future sessions immediately, and repair the specific mismatched future sessions already in the database.

What I found
- The wrong Saturday 8:00 AM “Signature Flow Pilates – All Levels” session is a real future `class_sessions` row in the database, not just a UI cache issue.
- Its linked recurring schedule is now set to Saturday 11:00 AM, but the session row still says 8:00 AM.
- Thursday/Friday also have active recurring schedules that are missing matching `class_sessions` rows, which is why classes you added do not appear.
- Root cause: `src/pages/admin/ClassSchedules.tsx` correctly runs `reconcile_and_generate_class_sessions` after create/edit/delete, but `src/pages/admin/ClassTypeDetail.tsx` does not. So edits made there drift the future session table out of sync.

Plan

1. Fix the missing reconciliation in Class Type Detail
- Update `src/pages/admin/ClassTypeDetail.tsx` so all schedule mutations:
  - create schedule
  - update schedule
  - toggle active/inactive
  - delete schedule
  also call `reconcile_and_generate_class_sessions` before success handling.
- Match the existing working pattern already used in `src/pages/admin/ClassSchedules.tsx`.

2. Invalidate all schedule/session queries after those edits
- After reconciliation, invalidate the same query keys used elsewhere for:
  - public schedule
  - member schedule hooks
  - admin classes day view
  - admin calendar
  - class-schedules-for-type
- This ensures the website, member app, and admin screens all refresh from the same source of truth.

3. Repair the already-broken future session data
- Add a migration that runs reconciliation for current/future dates so existing drift gets corrected in the backend.
- This should:
  - move the Saturday session from the stale 8:00 AM to the current 11:00 AM schedule when safe
  - generate the missing Thursday/Friday session rows
  - hide obsolete future sessions tied to removed/inactive schedules

4. Guard against “stuck stale session” edge cases
- The current reconciliation only updates future sessions when `current_enrollment = 0`.
- Keep that protection for booked sessions, but improve the admin UX messaging so if a future session has bookings and no longer matches the template, staff see that it must be edited/cancelled intentionally rather than silently drifting.
- For unbooked future sessions, reconciliation remains authoritative.

5. Verify schedule source-of-truth behavior
- Ensure public/member/admin schedule views all read from `class_sessions` consistently after reconciliation.
- Confirm cancelled sessions remain visible only in admin, while public/member views only show valid bookable sessions.

Files to change
- `src/pages/admin/ClassTypeDetail.tsx`
- new migration to run reconciliation / repair current future session drift

Expected result
- If you change a recurring class anywhere in admin, the actual bookable schedule updates everywhere.
- The incorrect Saturday 8:00 AM class disappears and the correct Saturday 11:00 AM class appears.
- The Thursday/Friday classes you added will show up.
- Public site, member view, and admin view stop disagreeing.

Technical details
- Confirmed active recurring schedules in the database:
  - Thursday: Signature Flow at 10:00 AM and Signature Flow Pilates – All Levels at 5:30 PM
  - Friday: Reformer Sculpt – Adv/Int (Heated) at 9:00 AM and Reformer Sculpt at 10:00 AM
  - Saturday: Reformer Sculpt – Adv/Int (Heated) at 10:00 AM, Signature Flow Pilates – All Levels at 11:00 AM, Full Body Strength at 12:00 PM
- Confirmed broken future session:
  - Saturday 2026-03-28 has an unbooked visible session at 8:00 AM for Signature Flow Pilates – All Levels even though its active schedule is now 11:00 AM
- Confirmed missing generated rows:
  - Thursday 10:00 AM Signature Flow has no matching `class_sessions` row
  - Friday 10:00 AM Reformer Sculpt has no matching `class_sessions` row
- Primary code defect is in `src/pages/admin/ClassTypeDetail.tsx`, where schedule CRUD mutates `class_schedules` directly without running the reconciliation RPC afterward.
