
Fix the class schedule system end-to-end so admin, website, and member-facing views all use the same source of truth and stop showing stale/generated mismatches.

1. Establish the real source of truth
- Treat `class_schedules` as the authoritative weekly template.
- Audit how `class_sessions` are generated and why future sessions no longer match the current active schedule list.
- Specifically fix the stale future-session problem: old generated sessions are still hanging around even after schedules were edited, replaced, or deactivated.

2. Repair session generation + sync behavior
- Update the backend generation/sync logic so future `class_sessions` stay aligned with `class_schedules`.
- Add a proper reconciliation flow for future sessions:
  - hide or cancel future sessions created from inactive/removed schedules
  - update future sessions when recurring schedule times/rooms/instructors change
  - prevent duplicate overlapping sessions from old and new schedule rows both appearing
- Keep past sessions untouched for history/audit.

3. Unify all schedule screens around the same rules
- Admin class management:
  - make the recurring schedule page clearly reflect active vs inactive schedule templates
  - make the admin sessions calendar reflect the reconciled future sessions only
- Public website:
  - ensure `/schedule` only shows the cleaned, active, bookable future sessions
- Member portal:
  - make member-facing schedule/booking surfaces use the exact same session filtering and timing rules as the public schedule

4. Remove logic drift between pages
- Extract shared schedule-query/filter logic instead of each page hand-rolling slightly different queries.
- Standardize:
  - hidden/cancelled filtering
  - active class-type filtering
  - past/today session handling
  - time formatting/day grouping
- This prevents admin, website, and portal from disagreeing again.

5. Add an admin recovery action
- Add a one-click “rebuild upcoming sessions” or “reconcile schedule” action in admin.
- This will resync future generated sessions from the current recurring schedule setup after edits, instead of leaving the database in a mixed old/new state.

6. Validate the specific mess currently in the database
- Reconcile the existing future schedule data already generated so the app stops showing wrong classes immediately after implementation.
- Focus on duplicate Sunday/Monday reformer/cycle entries and stale hidden/inactive remnants already present in future sessions.

Technical notes
- Current issue appears to be structural:
  - `class_schedules` contains multiple old/inactive and replacement rows
  - `class_sessions` for upcoming dates were generated from older schedule states
  - frontend pages query `class_sessions` directly, so stale generated rows leak into website/admin/member experiences
- The fix should be backend-first, then shared frontend querying.
- Past sessions should not be mutated; only upcoming/future sessions should be reconciled.

Files likely involved
- `src/pages/admin/ClassSchedules.tsx`
- `src/components/admin/WeeklyCalendarView.tsx`
- `src/components/admin/AdminSessionsCalendar.tsx`
- `src/pages/admin/Classes.tsx`
- `src/pages/Schedule.tsx`
- `src/hooks/useClassSessions.ts`
- backend migration(s) updating schedule/session sync functions
- possibly `supabase/functions/process-session-generation/index.ts`

Result
- The recurring schedule you set in admin becomes the single truth.
- Admin weekly calendar, admin class list, website schedule, and member booking views all agree.
- Old generated sessions stop polluting future weeks.
- You get a safe way to rebuild upcoming sessions whenever schedule templates change.
