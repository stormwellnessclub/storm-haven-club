

## Plan: Staff Schedule page (`/admin/staff-schedule`)

A unified weekly + daily schedule for the entire team — staff, instructors, and therapists — with recurring templates, per-date overrides, PTO, and shift notes.

### Database (3 new tables)

**`staff_shift_templates`** — recurring weekly baseline
- `id`, `user_id` (auth.users), `day_of_week` (0–6), `start_time`, `end_time`
- `position` (text, e.g. "Front Desk", "Closer"), `notes` (text), `is_active` (bool)
- `effective_from` / `effective_to` (date, nullable) — optional date bounds

**`staff_shifts`** — specific dated shifts (overrides + ad-hoc)
- `id`, `user_id`, `shift_date` (date), `start_time`, `end_time`
- `position`, `notes`, `template_id` (nullable FK — links to template if generated from one)
- `status` enum: `scheduled` | `pto` | `cancelled` | `swapped`
- `created_by`, `created_at`, `updated_at`
- Unique-ish: a date+user can have multiple shifts (split shifts allowed)

**`staff_time_off_requests`** — PTO/off-day requests
- `id`, `user_id`, `start_date`, `end_date`, `reason`, `status` (`pending`|`approved`|`denied`), `reviewed_by`, `reviewed_at`, `notes`

**RLS**: staff can read their own shifts + all shifts (team visibility); only managers/admins/super_admins can write. Time-off requests: staff can create/view their own, managers approve.

**Resolution rule**: For any given date, the displayed schedule = `staff_shifts` rows for that date if any exist, otherwise generated from the matching `staff_shift_templates`. PTO rows on a date suppress template-generated shifts for that user that day.

### People sourced

The "team" list pulls from three sources, deduped by email:
1. Everyone in `user_roles` (staff)
2. Everyone in `instructors` (matched to auth users by email when possible)
3. Everyone in `spa_therapists` (matched by email)

Instructors/therapists without auth accounts still appear as scheduleable "people" — `user_id` nullable in shift rows, with a `person_ref` (email) fallback. _Decision needed only if you want non-auth therapists to be schedulable; otherwise we restrict to auth users only — defaulting to **include all, with email fallback**._

### UI: `/admin/staff-schedule`

**Header**: title, week/date picker, view toggle (Week ⇄ Day), "Add Shift" button, "Manage Templates" button, "Time Off" button.

**Week view** (default)
- Grid: rows = team members (grouped: Managers / Front Desk / Instructors / Therapists), columns = Mon–Sun
- Each cell shows shift block(s): `8a–4p · Front Desk` with note tooltip
- Color coding: blue=scheduled, amber=PTO, gray=template-generated (not yet customized), red ring=conflict
- Click empty cell → "Add shift" dialog; click existing → edit/delete
- Conflict detection: overlapping shifts for same person, double-booked instructors vs. their class_schedules

**Day view**
- Hour timeline (6am–10pm) × team members
- Same shift blocks as horizontal bars
- Quick "Who's on now" summary at top

**Templates manager** (dialog or side sheet)
- Per-person weekly recurring template editor
- "Generate shifts for week of [date]" button → materializes templates into `staff_shifts` rows for that week (lets you then edit individual days)

**Time-off panel** (dialog)
- List pending requests with approve/deny
- "Mark off" quick action from the grid

### Sidebar / routing
- Add **"Staff Schedule"** link to admin sidebar under the "Staff" / "People" section (next to Staff Roles, Staff Hub)
- Route: `/admin/staff-schedule` → new `StaffSchedule.tsx` page

### Files

**New**
- `src/pages/admin/StaffSchedule.tsx`
- `src/components/admin/staff-schedule/WeekGridView.tsx`
- `src/components/admin/staff-schedule/DayTimelineView.tsx`
- `src/components/admin/staff-schedule/ShiftDialog.tsx` (add/edit/delete a single shift)
- `src/components/admin/staff-schedule/TemplateManagerDialog.tsx`
- `src/components/admin/staff-schedule/TimeOffPanel.tsx`
- `src/lib/staffScheduleResolution.ts` (template + override + PTO merging logic)

**Modified**
- `src/App.tsx` (add route)
- `src/components/admin/AdminSidebar.tsx` (add nav link)

**Migrations**
- Create the 3 tables, enums, indexes, RLS policies, and an RPC `generate_shifts_from_templates(week_start date)` for materializing a week.

### Out of scope (call out for later if wanted)
- Shift swap requests between staff
- Payroll/hours export
- Mobile staff-side "my schedule" view (we can add to existing Staff Hub later)
- Auto-publishing/notifications when schedule changes

