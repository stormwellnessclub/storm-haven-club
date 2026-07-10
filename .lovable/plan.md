
# Instructor Portal — Plan

Personal login for each instructor. Editorial minimalist dashboard (cream/charcoal/gold, Instrument Serif + Inter). Pay model is **Mixed — configured per instructor** (per-class flat rate OR hourly OR both). Ships in three phases; each phase is deployable on its own.

---

## Phase 1 — Foundation (auth, shell, Today view)

**Backend**
- Add `instructor` role to `app_role` enum. Extend `has_any_role` allowlist patterns as needed.
- Extend `instructors` table:
  - `user_id uuid` (FK → `auth.users`, links portal account)
  - `pay_type` enum: `per_class | hourly | mixed`
  - `default_per_class_rate numeric`, `hourly_rate numeric`
  - `portal_enabled boolean`, `invited_at`, `last_login_at`
- Trigger on `auth.users` insert: if email matches `instructors.email`, link `user_id` + assign `instructor` role.
- Admin-only RPC `admin_invite_instructor(instructor_id)` that sends the standard Supabase invite email using existing auth-email-hook.

**Frontend**
- Route `/instructor/*` guarded by `instructor` role. Existing role redirector sends instructors here on login.
- `InstructorShell` — sidebar (Today, Schedule, Rosters, Availability, Time Off, Subs & Swaps, Class Notes, Hours & Pay, Messages, Documents) + top-right actions (Request Sub, Clock In). Cream background, charcoal sidebar-active, gold accent, Instrument Serif greeting.
- **Today** page: greeting header, "Up Next" dark hero card (next `class_sessions` row with matching `instructor_id`), remaining classes list, weekly hours + estimated pay tile, "Needs Attention" list (unsigned docs, expiring certs, pending sub requests), Club Announcements block, 7-day dot strip.

## Phase 2 — Teaching workflow

**Rosters & Class Notes** (reuses existing `ClassRoster` data)
- `/instructor/schedule` — month/week view scoped to `instructor_id = me`.
- Roster drawer: attendee list with member/non-member/guest identity badges (already built), mark no-show, add per-attendee note.
- New table `instructor_class_notes` (session_id, instructor_id, note, is_admin_visible). RLS: instructor CRUD own, admin read all.

**Availability & Time Off**
- New tables:
  - `instructor_availability` (instructor_id, day_of_week 0-6, start_time, end_time, effective_from, effective_to)
  - `instructor_time_off` (instructor_id, start_date, end_date, reason, status: pending/approved/denied, admin_note)
- Admin dashboard shows conflicts before scheduling a session.

**Subs & Swaps**
- New table `instructor_sub_requests` (session_id, requester_id, reason, status: open/claimed/approved/denied, claimed_by, admin_decision_by, decided_at).
- Instructor requests sub → visible to eligible instructors on their portal → they "offer to cover" → admin approves → session `instructor_id` reassigned; both parties notified via existing email hook.

## Phase 3 — Time, pay, docs, messaging

**Hours & pay (Mixed model)**
- New tables:
  - `instructor_clock_events` (instructor_id, session_id nullable, clock_in_at, clock_out_at, source: `session_auto | kiosk_pin | manual_admin`)
  - `instructor_pay_periods` (start_date, end_date, status: open/closed/paid)
  - `instructor_pay_lines` (instructor_id, pay_period_id, session_id nullable, kind: `per_class | hourly | adjustment`, hours numeric, rate numeric, amount numeric, note)
- Compute logic (server function): for each closed session in the period, look at that instructor's `pay_type` — `per_class` → add per-class line at their rate; `hourly` → add hours line from paired clock events; `mixed` → whichever is configured on that class type.
- Instructor sees: current period hours + estimate on Today; full history + downloadable statement PDFs on `/instructor/pay`.
- Kiosk PIN clock-in reuses existing `staff_pins` / `staff_shift_clocks` infrastructure (already built for front desk) — instructor entries are tagged `role='instructor'` so front-desk timesheet and instructor timesheet stay separate.

**Documents & certifications**
- New table `instructor_documents` (instructor_id, kind: `w9 | 1099 | cert | waiver | other`, file_path, expires_at, uploaded_by, verified_by).
- Storage bucket `instructor-documents` with RLS (owner + admin).
- Expiration reminder cron (30/14/7/1 day) surfaces on Today and sends email.

**Messaging & announcements**
- Reuse existing `staff_messages` / `staff_channels` for admin ↔ instructor DMs.
- New `instructor_announcements` (title, body, published_at, expires_at) — admin composes, all instructors see on Today.

## Admin backend — Instructor Management

New `/admin/instructors` section (extends the existing Instructors table):
- **Roster** — list with portal status (invited / active / disabled), last login, upcoming class count, unresolved sub requests.
- **Profile editor** — pay type + rates, class-type authorizations, bio, headshot, portal enabled toggle, "Send portal invite" button.
- **Schedule & availability** — merged view of taught sessions + declared availability + approved time off. Conflict badges when scheduling.
- **Sub requests queue** — approve/deny with one click; reassigns session.
- **Timesheets** — per-instructor hours worked, per-pay-period, export CSV/PDF; edit clock events (audited in `admin_action_log`).
- **Payroll run** — close a pay period, freeze the ledger, mark paid, download combined statement.
- **Documents** — verify uploads, request missing docs, see expiring certs.
- **Announcements composer** — publish to all instructors.

## Technical notes

- All new `public` tables get GRANTs for `authenticated` + `service_role`, RLS enabled, policies gated by `auth.uid()` matching `instructor.user_id` OR `has_any_role(...admin variants...)`.
- No new external services: reuses Lovable auth-email-hook for invites/reminders, existing storage patterns, existing staff PIN clock infrastructure.
- Timezone: all hours-worked math in `America/Chicago` per the project rule.
- Design tokens: extends existing cream/charcoal/gold — no new palette. Instrument Serif already loaded on marketing pages; added to portal via existing `@fontsource` install pattern.

## Delivery order

1. Phase 1 (auth + shell + Today) — instructors can log in and see their day. **Ship first.**
2. Phase 2 (schedule, rosters, availability, time-off, subs) — the teaching workflow.
3. Phase 3 (hours & pay, docs, messaging) — the operational back office.
4. Admin `/admin/instructors` section is built alongside each phase so admin has full oversight from day one of every capability.
