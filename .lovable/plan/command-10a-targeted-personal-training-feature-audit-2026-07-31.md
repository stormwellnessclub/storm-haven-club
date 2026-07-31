# Command 10A — Targeted Personal Training Feature Audit

Read-only audit. No database or code changes were made. Findings below are verified against the live schema (33 `pt_*` tables), the 15 desktop PT pages, 10 mobile trainer routes, 21 PT hooks, and the routing table.

Legend: **FF** fully functional · **PF** partially functional · **VO** visual only · **MI** missing · **DUP** duplicated elsewhere · **CFG** requires configuration · **DBM** requires migration · **3P** requires third-party integration

---

## 1. Exercise system

Backing table `pt_exercise_library` has only: `name, muscle_group, equipment, notes, is_active, media_url, cues, category, default_sets/reps/tempo/rest`. `PTLibrary.tsx` is 121 lines: one search box, one flat table, one modal.

| Feature | Status |
|---|---|
| Dedicated route, view all, search (name/muscle/equipment/category) | FF |
| Create, edit | FF |
| Archive (trash icon sets `is_active`), exercise use in programs (`pt_program_exercises.exercise_id`) and Live Session Mode (`pt_session_exercises`) | FF |
| Filtering by facet (chips/dropdowns) | MI — search only |
| Duplicate, restore archived, delete-when-unused, block delete when historically used | MI |
| Images / videos | PF — single `media_url` text field, no upload, no type distinction |
| Client-facing instructions vs trainer-only cues | PF — one `cues` field, no visibility split |
| Secondary muscles, movement pattern, difficulty, tracking method | MI / DBM |
| Substitutions, progressions, regressions, contraindications | MI / DBM — `pt_program_exercises.substitution` is free text only |
| Client exercise history, previous weight/reps | PF — data exists in `pt_session_sets` + `previous_result`, no per-exercise history view in the library |
| Visibility permissions | MI — library is staff-wide, no per-trainer/private flag |

**Recommendation:** extend `pt_exercise_library` (DBM) with `secondary_muscles text[]`, `movement_pattern`, `difficulty`, `tracking_method`, `client_instructions`, `contraindications`, `image_url`, `video_url`, `substitute_ids uuid[]`, `progression_id`, `regression_id`, `owner_instructor_id`, `is_public`. Add a `pt_exercise_media` bucket for uploads. Guard deletes with a SECURITY DEFINER RPC that checks `pt_program_exercises`/`pt_session_exercises` references and archives instead. Extend `PTLibrary.tsx` and `usePTProgramBuilder`, do not create a second library page. Low migration risk (additive).

---

## 2. Trainer management

Trainers are rows on `instructors` (has `portal_enabled, invited_at, is_public_pt, employment_status, can_self_book, can_edit_others_appointments, default_location_id, specialties, bio, photo_url, is_active`). `PTTrainers.tsx` is read-only + CSV export; all editing lives on legacy `PersonalTrainingTrainers.tsx`.

| Feature | Status |
|---|---|
| Add / edit / activate / deactivate trainer, invite, portal login toggle | DUP — works on the legacy page, absent in `/admin/pt/trainers` |
| Configure services (`pt_trainer_formats`), locations (`pt_trainer_locations`), specialties | DUP — legacy page |
| Public visibility (`is_public_pt`), self-book (`can_self_book`) | PF — columns exist, no single UI that groups them |
| Archive / restore as distinct from deactivate | MI |
| Delete when safe | MI |
| Reassign clients (`pt_client_trainers`) / reassign future appointments | MI — no bulk reassignment tool |
| Preserve historical records | FF — appointments keep `instructor_id`; nothing hard-deletes |
| Granular trainer permissions | PF — only two booleans; role gating is via `user_roles` |
| Accepts new clients flag | MI / DBM |

**Recommendation:** fold the legacy trainer editor into `/admin/pt/trainers` as a detail drawer (retire the legacy route to avoid two sources of truth). Add `accepts_new_clients`, `archived_at` to `instructors`. Reassignment needs an RPC that moves `pt_client_trainers` and future `pt_appointments` in one transaction with an audit row in `pt_audit_log`.

---

## 3. Availability and blocking

`pt_trainer_availability(weekday, start_time, end_time)` and `pt_trainer_overrides(date, kind, start_time, end_time, note)`.

| Feature | Status |
|---|---|
| Standard weekly hours, multiple windows per day (multiple rows), date-specific availability, one-off blocks, time-off, private note on a block | FF |
| Recurring availability | FF (weekday rows) |
| Recurring blocks, lunch/break as a distinct type, facility closures (all-trainer), internal holds, public-facing unavailable label | MI / DBM |
| Block approval workflow | MI — related `staff_time_off_requests` exists but is not wired to PT |
| Per-trainer buffer, min notice, max advance, cancellation rules | MI / DBM — only global `pt_session_types.duration_minutes` |
| Trainer double-booking prevention | FF — enforced in `book_pt_appointment` |
| Room / equipment / location conflicts | MI — `pt_locations` is a label only, no capacity model |

**Recommendation:** add `pt_schedule_blocks` (DBM) with `scope` (trainer/facility), `block_type`, `rrule`/recurrence fields, `is_public_reason`, `requires_approval`, `approved_by`. Add booking-policy columns to `instructors` or a `pt_trainer_policies` table. Extend `book_pt_appointment` to consult blocks and policies server-side — the conflict check must live in the RPC, not the UI.

---

## 4. Visibility controls

| Control | Status |
|---|---|
| Show on public website (`is_public_pt`), show bio/photo/specialties (columns exist) | PF — one flag drives all surfaces |
| Show in member portal / non-member portal independently | MI |
| Allow direct online booking | PF — `can_self_book` exists but no client-side booking path consumes it |
| Assigned-clients-only / new-clients-only booking | MI |
| "Any available trainer" | MI |
| Hide trainer while preserving internal availability | PF — deactivating removes them from scheduling too |

**Recommendation:** replace the single flag with a `visibility` JSON or discrete booleans on `instructors` (`show_public`, `show_member_portal`, `show_nonmember_portal`, `booking_mode`). Enforce in the RPC that lists bookable trainers, not in the component.

---

## 5. Services and booking

`pt_session_types` covers name, format, duration, capacity, `requires_package`, `required_format`, default location, price, `is_active`. `PTSettings.tsx` renders it read-only.

| Feature | Status |
|---|---|
| Session type data model (duration, capacity, semi-private participants, package-required, archive via `is_active`) | CFG — schema supports it, no admin CRUD screen |
| Create / edit / archive appointment types in UI | MI (VO today) |
| Eligible trainers / locations / packages per type | MI / DBM — no join tables |
| Buffer time | MI |
| Staff-only booking | FF — all booking is staff-initiated today |
| Instant booking, appointment requests | PF — `training_requests` table exists (service, preferred_times, goals, status) with an admin page, but no client-portal submit path into the PT workspace |
| Consultation-required, assigned-client-only | MI |
| Recurring appointments / booking series | MI |
| Waitlist | PF — `is_waitlist`, `waitlist_position` on appointments, no management UI |
| Cancellation / no-show policy config | PF — statuses `late_cancel`/`no_show` exist and are recorded; no configurable policy or automatic charge |
| Package deduction rules | FF — `package_deducted`, `pt_session_usage`, `pt_pass_adjustments` |

---

## 6. Member and non-member portals

| Feature | Status |
|---|---|
| PT as a separate dashboard tab in the member portal | MI — only two cards: `UpcomingPTAppointmentsCard`, `MyPTPassesSection` |
| PT in the non-member portal | MI — no PT surface at all |
| Next appointment, package balance | PF — visible in the cards |
| Assigned trainer, package expiration, current program, assigned workouts, exercise instructions, session recaps (`client_recap` exists), client-visible notes, progress charts, progress photos, PRs, reassessment status | MI on the client side — all data exists server-side and is rendered only in the admin/trainer portal |
| Booking / reschedule / cancel / waitlist by the client | MI |
| Messages, forms, documents (`pt_documents`), package purchase or renewal, notification preferences | MI client-side |
| Private notes stay hidden | FF — `pt_session_notes.private_note`, `pt_appointments.internal_notes`, `pt_client_profiles.internal_notes` are all behind staff-only RLS; no client query touches them |

**Recommendation:** one shared `PTClientDashboard` mounted at `/portal/training` and `/non-member/training`, reading through a new `get_my_pt_overview()` SECURITY DEFINER RPC that returns an explicitly whitelisted field set. Do not expose `pt_*` tables to `authenticated` directly — that is the main data-leak risk in this phase.

---

## 7. Onboarding and assessments

| Feature | Status |
|---|---|
| PT inquiry | PF — `training_requests` captures it, no automated pipeline |
| Goals, injury history, medical notes, PAR-Q status/expiry, medical clearance flag | CFG — columns exist on `pt_client_profiles`, no intake form writes them |
| Waiver / training agreement | PF — general `agreements` table exists; `pt_documents.doc_type` can hold them, no PT-specific flow |
| Consultation booking | MI |
| Baseline assessment, reassessment status | PF — `pt_performance_tests` with `is_reassessment`, `pt_programs.next_reassessment`, and a `PTReassessments` page |
| Historical comparison | PF — data is there, no comparison view |
| Assessment templates, reassessment reminders | MI |
| Trainer assignment, package assignment, initial program, first appointment | FF — all doable individually by staff; MI as a guided onboarding checklist |

---

## 8. Communication and automation

| Feature | Status |
|---|---|
| Communication log (email/sms/internal, direction, delivery status) | FF — `pt_communications` + `PTMessages` page |
| Trainer-to-client / staff-to-client outbound send from the PT portal | MI — the page is read-only |
| Internal PT communication | PF — `pt_notes` (trainer scratchpad) |
| Appointment reminders | PF — `send-pt-booking-email` sends confirmations; no scheduled PT reminder job (class/spa have theirs) |
| Package-low / expiration reminders | PF — `pt_passes.renewal_reminder_sent_at/count` and `process-renewal-reminders` exist; needs verification that PT passes are in scope |
| Incomplete-form, reassessment, incomplete-note, inactivity reminders, weekly check-ins | MI |
| Pain alerts | PF — `pt_session_sets.pain_flag`, `pt_session_notes.pain_discomfort`, `pt_alerts` table; no automatic alert creation |
| Follow-up tasks | FF — `pt_tasks` with recurrence and a task board |
| Automation logs | PF — `pt_activity_log`, `pt_audit_log` |
| Duplicate-notification prevention | PF — pattern exists elsewhere (`monthly_credit_grants` ledger); not applied to PT |

**Recommendation:** one `process-pt-automations` cron edge function writing to a `pt_notification_log` with a unique key per (recipient, type, period) for idempotency. Must use the existing `requireTrustedCaller` guard.

---

## 9. Reporting and security

`PTReports.tsx` + `usePTReportData` already produce: trainer utilization (booked/completed/cancelled/no-show/hours/utilization/notes-done rate), package revenue and usage, package balances with expiry and days-left, client retention/attendance, program adherence.

| Report | Status |
|---|---|
| Trainer utilization, sessions completed, cancellations, no-shows, package balances, package expiration, revenue by service/package, client retention, program adherence | FF |
| Incomplete session notes | PF — a "notes done %" column, not a drillable list |
| Trainer availability report | MI |
| Revenue by trainer | MI — revenue is attributed to package, not trainer |
| Package liability (unearned revenue) | MI |
| Reassessment report | PF — `PTReassessments` page, not in Reports |

**Security:** role checks are enforced server-side via `has_any_role()` RLS across `pt_*` tables and inside `book_pt_appointment` / `cancel_pt_appointment`, so hiding buttons is not the only control. Two gaps to close during the build: several PT pages query tables through `(supabase as any).from(...)` directly, so any new client-facing surface must go through RPCs; and `pt_client_profiles.internal_notes` / `pt_session_notes.private_note` must never enter a client-facing selection list.

---

## Recommended order for 10B – 10I

1. **10B — Exercise library expansion.** Additive migration + `PTLibrary.tsx`. No dependencies; unblocks program and live-session quality.
2. **10C — Trainer management consolidation.** Merge the legacy editor into `/admin/pt/trainers`, add archive/restore and client reassignment.
3. **10D — Availability, blocks and booking policies.** Depends on 10C owning the trainer record.
4. **10E — Visibility and booking-eligibility model.** Depends on 10D policies.
5. **10F — Services and appointment-type CRUD, waitlist, recurring series.** Depends on 10E.
6. **10G — Client-facing PT dashboard (member + non-member), request-only booking.** Depends on 10E/10F for what clients may see and request.
7. **10H — Onboarding, intake forms and assessment templates.** Depends on 10G for the client-facing form surface.
8. **10I — Automation, notifications and reporting gaps.** Last, because it consumes every model added above.

Audit ends here. No build work started.
