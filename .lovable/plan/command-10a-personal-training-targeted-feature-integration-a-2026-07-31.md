# Command 10A — Personal Training Targeted Feature & Integration Audit

Read-only audit of what the PT system actually contains today, so 10B onward extends instead of duplicating. No code was changed.

## 1. What already exists (reuse, do not rebuild)

**Admin/trainer PT portal** — 15 desktop pages under `/admin/pt` (dashboard, schedule, clients, client detail, programs, library, reassessments, session notes, progress, packages, trainers, tasks, messages, reports, settings) plus 10 mobile trainer routes under `/admin/pt/m`. Shared shell, sidebar, top bar, global search, appointment drawer, workout editor, and a `PTUI` primitive kit (`PTShell`, `PTCard`, `PTTable`, `PTModal`, `PTBadge`, `ptButtonClass`). 21 dedicated hooks in `src/hooks/pt/`.

**Legacy admin PT pages** (still live, outside the new portal): packs, passes, schedule, trainers, unpaid payments, training requests.

**Database** — already present and populated: `pt_appointments`, `pt_client_profiles`, `pt_client_trainers`, `pt_packs`, `pt_passes`, `pt_pass_adjustments`, `pt_session_types`, `pt_session_notes`, `pt_session_exercises`, `pt_session_sets`, `pt_session_usage`, `pt_programs`, `pt_program_days`, `pt_program_exercises`, `pt_exercise_library`, `pt_body_metrics`, `pt_performance_tests`, `pt_progress_photos`, `pt_prs`, `pt_milestones`, `pt_documents`, `pt_communications`, `pt_tasks`, `pt_notes`, `pt_alerts`, `pt_locations`, `pt_trainer_availability`, `pt_trainer_overrides`, `pt_trainer_formats`, `pt_trainer_locations`, `pt_saved_views`, `pt_audit_log`, `pt_activity_log`, plus `training_requests`.

**Trainer identity** — trainers live on `instructors` and already carry `is_public_pt`, `can_self_book`, `can_edit_others_appointments`, `employment_status`, `portal_enabled`, `schedule_color`, `default_location_id`, pay fields. Contact/pay data is staff-only via the `get_instructors_with_contact` RPC.

**Client identity** — `pt_client_profiles` is keyed to the single Storm identity (`user_id` + optional `member_id`), with PAR-Q fields, injuries, medical notes, emergency contact, tags, preferences. No new client table is needed.

**Member portal PT surface today** — only two cards: `UpcomingPTAppointmentsCard` (on `/portal` and `/member` dashboards) and `MyPTPassesSection` on `/portal/passes`. There is no PT dashboard page.

**Non-member portal PT surface today** — none.

## 2. Confirmed gaps (what 10B–10I must build)

| Area | Current state | Gap |
| --- | --- | --- |
| Exercise Library | `PTLibrary.tsx` (121 lines) — searchable table, create/edit modal, archive. Columns exist for category, muscle group, equipment, media, cues, defaults. | No video/image upload (URL only), no filter chips, no bulk/CSV seed, no tagging by movement pattern/level, no "used in N programs" usage view, no duplicate detection, no restore of archived items. |
| Trainer management | New portal `PTTrainers.tsx` is **read-only** (zero mutations). Legacy `/admin/personal-training/trainers` handles availability, overrides, formats, notes, visibility toggles. | No create trainer, no edit profile/photo/bio/specialties, no deactivate/offboard flow (reassign clients, cancel future sessions, revoke portal access). Two competing trainer screens. |
| Availability & blocking | `pt_trainer_availability` (weekday + times) and `pt_trainer_overrides` (single date block/extra) exist and are edited in the legacy page. | No recurring unavailability (e.g. every Friday PM for 8 weeks), no date-range block, no visual calendar of blocked time, availability not enforced anywhere in booking. |
| Services & booking rules | `pt_session_types` has duration, capacity, format, price, requires_package, location. `PTSettings` displays them **read-only**. | No editor for session types, no lead time / cancellation window / max advance window / buffer rules, no per-trainer service assignment surfaced in the portal. |
| Waitlist & requests | `pt_appointments.is_waitlist` + `waitlist_position` columns exist and the schedule hook renders a "waitlisted" lifecycle. `training_requests` exists for public leads. | No client-facing request flow, no queue management UI, no promote-from-waitlist action, no notification on promotion. |
| Member PT dashboard | Two cards only. | No `/member/personal-training` page: upcoming/past sessions, package balance, assigned program, progress, documents, messages, request appointment. |
| Non-member PT dashboard | Nothing. | Same needs, package purchase deferred per your direction. |
| Onboarding / assessments | `parq_status`, `pt_documents`, `pt_performance_tests`, `pt_body_metrics` exist; `PTReassessments.tsx` (183 lines) is a light list. | No structured intake/onboarding checklist, no assessment template, no reassessment scheduling/automation. |
| Communications & automations | `pt_communications` and `pt_tasks` (with recurrence columns) exist; `PTMessages.tsx` is 115 lines. | No outbound send from the portal, no automated session reminders, no client check-in cadence, no task automation running on a schedule. |
| Reports | `PTReports.tsx` (389 lines) exists. | Needs utilization, no-show/late-cancel, trainer productivity, package burn-down, revenue-per-trainer, unpaid exposure. |

## 3. Decisions locked in from your answers

- **Booking model: request only.** Clients never write directly into a trainer's calendar. They submit an appointment request that includes a required preferred time-frame note. Staff/trainer confirms, which creates the `pt_appointments` row.
- **Request queue is first-come, first-served,** ordered by submission time. The client sees only "requested / confirmed / declined" — position in queue is visible to trainers and admins only.
- **Non-members:** target is book + buy online, but for now only the request flow ships. Online self-booking stays switched off behind a setting until you open the schedule; online package purchase comes later.
- Trainer availability data is reused as-is and extended with recurring/range blocking rather than replaced.

## 4. Consolidation recommendation before 10C

There are two trainer screens (new portal read-only vs legacy full-featured) and two settings surfaces. Proposal: make `/admin/pt/trainers` the single trainer workspace by moving the legacy availability/override/format/notes editors into it, and leave the legacy route as a redirect. Same for session types: make `/admin/pt/settings` editable rather than adding a third screen. This avoids the duplicate systems you flagged.

## 5. What happens next

Nothing is built until you send the 10B command. When you do, 10B should be scoped as **extending `PTLibrary.tsx` and `pt_exercise_library`** — not creating a new library — with the specific gaps in the table above as the candidate list. Tell me which of those Exercise Library gaps matter to you and I will implement exactly those.

## Technical notes

- No migration is needed for 10A. Anticipated later migrations: recurring-block columns on `pt_trainer_overrides` (or a `pt_trainer_block_rules` table), booking-rule columns on `pt_session_types`, an appointment-request table or reuse of `pt_appointments` with a `requested` status plus a `preferred_window` text field, and an assessment-template table.
- All new client-facing reads must go through RLS scoped to `auth.uid()`; trainer/staff reads continue through the existing `has_any_role()` pattern and the staff-only RPCs already in place.
