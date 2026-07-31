# Personal Training Portal — Production Build

A full PT workspace inside the admin area, matching the attached Storm mockups, built on the existing PT tables (`pt_appointments`, `pt_passes`, `pt_packs`, `pt_trainer_availability`, `pt_trainer_formats`, `pt_trainer_overrides`, `pt_notes`, `pt_session_usage`, `training_requests`). Nothing existing is removed — current PT pages are absorbed into the new shell and keep working.

## Design system (Phase 0)

- New PT theme tokens in `index.css` / `tailwind.config.ts`: dark brown `#211C17` / `#302820`, cream `#F7F3ED`, beige `#E8DED0`, taupe border `#D4C8BA`, muted text `#71675D`, gold `#B3915F`, green `#176B50`, amber `#C88B2A`, red `#B94C45`. All used as semantic tokens, no hardcoded colors in components.
- Serif display font for page titles/section headers, modern sans for all UI text.
- Shared primitives: `PTPageHeader`, `PTKpiCard`, `PTPanel`, `PTDataTable` (sort + search + pagination), `PTStatusBadge`, `PTEmptyState`, `PTLoading`, `PTConfirmDialog`, `PTSlideOver`.
- `PTLayout`: dark left nav + cream workspace + optional right contextual rail; desktop-first, tablet collapse, dedicated mobile trainer view.

## Phase 1 — Dashboard & Schedule (`/admin/pt`, `/admin/pt/schedule`)

- KPI row from live queries: today's sessions (+completed), active clients, open tasks, new leads (from `training_requests`), sessions this week, pack usage %.
- Day/Week timeline by trainer with real appointments; trainer and session-type filters; date navigation.
- Click a session → slide-over with reschedule (drag or form), change trainer, cancel with reason, mark completed / no-show, deduct or restore a pack session, add session note, collect payment.
- Right rail: Upcoming Tasks (new `pt_tasks` table), Recent Check-ins (from appointment status changes), Client Alerts (expired packs, no-shows, overdue reassessments), Quick Actions (Book, Add Client, Create Task, Message, Package Sale, Check-in) — each opens a working flow.
- Waitlist slots and "hold" blocks rendered from `pt_trainer_overrides`.

## Phase 2 — Clients list & Client profile (`/admin/pt/clients`, `/admin/pt/clients/:userId`)

- Searchable, filterable, paginated client list across members and non-members with PT history.
- Profile header: photo, contact, primary trainer (editable), member badge, Message / Call / Book Session / Add Note / Progress Check-In actions.
- Stat strip: active package, sessions remaining, next session, attendance rate, last visit, client status.
- Tabs: Overview, Sessions, Programs, Progress, Notes, Documents, Billing, Communication, Check-Ins, History — all reading and writing real data.
- Overview cards: client snapshot, goals & focus areas, training alerts/restrictions, alerts feed, body metrics, progress photos (storage bucket), internal trainer notes, session preferences, visit history, recent session notes.

## Phase 3 — Programs, Session Notes & Progress (`/admin/pt/programs`)

- Program builder: weekly split with reorderable days, exercise rows (sets, reps, load, tempo, rest, cues, substitution), supersets, notes, estimated duration, save as template, duplicate, assign to client, print/export.
- Session notes: subjective/objective/trainer observations, energy, mobility, modifications, RPE, homework, next-session focus; autosaved drafts.
- Progress tracking: sessions completed, weight trend, PRs, measurement milestones, compliance, reassessment scheduling — all charted from stored records (no fake data).

## Phase 4 — Packages, Trainers, Tasks, Payments

- Packages: existing packs/passes management restyled in the new shell; sell package (card on file, link, cash, comp), payment plans, expiration and renewal reminders.
- Trainers: profiles, formats, weekly availability, time-off overrides, per-trainer schedule and payroll-relevant session counts.
- Tasks & leads: `pt_tasks` CRUD with due dates, assignment, completion; `training_requests` becomes a lead pipeline with status changes.
- Payments: existing PT Session Payments page restyled and linked from every session and client profile.

## Phase 5 — Mobile trainer experience (`/trainer`)

- Redesigned mobile-first view for trainers: today's sessions, check clients in, log session notes, view client snapshot and program, mark complete/no-show. Role-scoped to their own clients.

## Technical details

New tables (each with GRANTs, RLS, and role-based policies using `has_any_role`):
- `pt_tasks`, `pt_client_profiles` (goals, restrictions, preferences, primary trainer), `pt_body_metrics`, `pt_progress_photos`, `pt_programs`, `pt_program_days`, `pt_program_exercises`, `pt_exercise_library`, `pt_session_notes`, `pt_prs`, `pt_reassessments`, `pt_activity_log`.
- Additions to `pt_appointments`: `completed_at`, `checked_in_at`, `no_show`, `is_waitlist`, `hold_label`.
- RPCs for atomic actions: complete session (+pack deduction), cancel/restore, reschedule with conflict check, assign program.
- Trainers see only their own clients/sessions; managers/admins see all; front desk gets booking + check-in only.

Delivery: after each phase I report routes, components, DB changes, working actions, and remaining gaps.
