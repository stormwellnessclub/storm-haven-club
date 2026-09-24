# Phase 2D.1 — PT Requests to Confirmed Appointment

Scope: request intake, staff review, confirm / alternate / decline / cancel, and exactly one `pt_appointments` row per confirmed request. No billing, package, autopay, reporting or calendar changes. No 2D.2.

## Current state (verified)
- `training_requests`: 23 rows, all status `new`. Columns: service, full_name, email, phone, preferred_times (free text), experience_level, goals, is_member, status, admin_notes, submitted_by_user_id. Policies: public INSERT, admin SELECT/UPDATE/DELETE. No client read-own policy.
- `pt_appointments`: 106 production rows; existing `book_pt_appointment` / `cancel_pt_appointment` RPCs.
- Existing admin page `TrainingRequests.tsx` and public `TrainingRequestForm.tsx` write to this table.

## 1. Snapshot first
Before any migration, save id/status/start/end/trainer of all 106 appointments to a snapshot table (`pt_appointments_snapshot_2d1`, staff-read only) for the preservation check.

## 2. Extend `training_requests` (additive only)
New nullable columns: `client_user_id`, `requested_trainer_id`, `pt_session_type_id`, `preferred_date`, `preferred_time`, `flexibility_note`, `client_note`, `request_status` (text, default `requested`, check: requested, under_review, alternate_offered, confirmed, declined, cancelled), `alt_date`, `alt_time`, `alt_trainer_id`, `alt_note`, `offered_at`, `offered_by`, `resolved_at`, `resolved_by`, `decline_reason`, `appointment_id` (FK to pt_appointments, UNIQUE), `reviewed_at`, `reviewed_by`.
- Backfill: existing `new` rows map to `requested`; old `status` column kept, marked deprecated. No guessing of trainer/date for old rows.
- Request status stays separate from appointment status.

## 3. Server-side RPCs (SECURITY DEFINER, staff role check)
- `pt_request_create(...)` — signed-in client creates own request (client_user_id = auth.uid()); cannot set status, trainer assignment outcome or appointment.
- `pt_request_mark_review`, `pt_request_change_trainer` (before confirmation only).
- `pt_request_offer_alternate(id, date, time, trainer?, note?)` — stores offer, sets `alternate_offered`, creates no appointment.
- `pt_request_confirm(id, use_alternate bool)` — row lock (`FOR UPDATE`); if already confirmed returns the existing appointment id; checks trainer overlap and client overlap against non-cancelled pt_appointments (cancelled / late_cancel / no_show excluded as current rules allow); inserts one appointment through the existing booking path; links `appointment_id`; sets confirmed + actor/time. UNIQUE on `appointment_id` plus the lock prevents duplicates on double-click or retry.
- `pt_request_decline(id, reason)` — reason required; `pt_request_cancel(id, reason?)`.
- Conflict errors return readable text, e.g. "Trainer already has a session 10:00–11:00 on Oct 2".
- Allowed staff: super_admin, admin, manager, and trainers only for requests assigned to them (confirm/alternate). Trainers receive no financial permissions.

## 4. RLS
- Clients: SELECT own rows (`client_user_id = auth.uid()`); direct INSERT limited to own rows via RPC; no UPDATE.
- Staff: existing admin policies kept. Public anonymous intake form continues to work unchanged.
- Clients still can never insert into `pt_appointments`.

## 5. Staff UI — `/admin/pt/requests`
- New PT portal nav item "Requests" and route (added to page permissions).
- Queue table, oldest first: client, member/non-member badge, submitted, requested trainer, session type, preferred date/time, flexibility, note, status, staff-only queue position. Status filter chips.
- Right-side detail panel (master-detail, no stacked dialogs): request info, compact PT context (active package, sessions remaining, payment warning from existing records — read only, links to Billing), action bar: Confirm, Offer alternate, Record client accepted alternate, Change trainer, Decline (reason), Cancel. Conflict messages shown inline. Resolution history shows actor + time.
- On confirm, a link opens the appointment in the existing PT schedule (same row, no sync).

## 6. Acceptance tests (disposable records, deleted after)
1 request → no appointment · 2 confirm → one appointment · 3 re-confirm → no duplicate · 4 trainer conflict blocked · 5 client overlap blocked · 6 alternate → no appointment · 7 accept alternate → one appointment at new time · 8 decline → closed, no appointment · 9 appears in `/admin/pt/schedule` (Playwright) · 10 all 106 production appointments match the snapshot.

## Technical notes
- Files: new migration(s), `src/pages/admin/pt/PTRequests.tsx`, `src/hooks/pt/usePTRequests.ts`, `App.tsx` route, PT nav, `permissions.ts`.
- Times interpreted in America/Detroit; appointment duration from the selected session type.
- The existing legacy `TrainingRequests.tsx` page stays working.

## Deliverable
Short completion report ending with `PHASE 2D.1 STATUS: COMPLETE`, then stop.
