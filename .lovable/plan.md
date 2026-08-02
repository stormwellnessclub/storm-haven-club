# Trainer Management & Advanced Availability

Upgrade Admin → PT Trainers so you can add/remove trainers yourself and control availability with far more precision: date-ranged schedules, public vs. internal-only windows, and blocked slots with an optional public reason.

## 1. Add and delete trainers

In the Trainers list:

- **Add trainer** button opens a form: first/last name, email, phone, bio, specialties, photo, public-on-website toggle, master-trainer toggle, pay type/rate. Creates the trainer record and marks it as a PT trainer.
- **Row menu** on each trainer:
  - **Edit** — same form, prefilled.
  - **Deactivate** (recommended) — removes them from booking, schedules, and the public site while keeping all past sessions, notes, and payroll intact.
  - **Reactivate** for deactivated trainers, shown behind a "Show inactive" toggle.
  - **Delete permanently** — only allowed when the trainer has no appointments, notes, or payroll history; otherwise the app blocks it and tells you to deactivate instead.

## 2. Availability with durations (effective dates)

Each weekly window gains an optional **start date** and **end date**:

- Leave both empty = ongoing (today's behavior).
- Set a range = the window only applies inside those dates. Good for "Tuesdays 6–10am, June 1 through August 31" or a summer sub schedule.
- Windows outside their range show as **Scheduled** (future) or **Ended** (past) in the list, so nothing silently disappears.

## 3. Public vs. internal availability

Each weekly window and each extra-hours date gets a **Visible to public** switch:

- **Public** — shown on the booking page; members and non-members can book into it.
- **Internal only** — invisible to the public; staff can still book clients into it from the admin side. Useful for holding hours for VIP clients or trial scheduling.

The list shows an eye / eye-off badge per window, plus a per-trainer summary of how many windows are public.

## 4. Blocked slots with reason control

The overrides editor becomes a **Time off & blocks** editor:

- Block a **full day** or a **specific time range** on a date.
- Optional **date range** so you can block a vacation week in one entry instead of seven.
- **Reason** field (e.g. "Vacation", "Staff meeting").
- **Show reason publicly** switch:
  - On — the booking page shows "Unavailable — Vacation".
  - Off — the booking page shows only "Unavailable" while staff still see your reason internally.

## Technical notes

Database (single migration):

- `instructors`: no new columns needed; add/delete flows use existing `is_active`, `is_public_pt`, `is_master`.
- `pt_trainer_availability`: add `effective_start` (date, null), `effective_end` (date, null), `is_public` (bool, default true), `label` (text, null).
- `pt_trainer_overrides`: add `end_date` (date, null, for multi-day blocks), `is_public_reason` (bool, default false), `is_public` (bool, default true for `extra` windows), rename usage of `note` to serve as the reason (kept as-is for compatibility).
- Keep existing RLS; add explicit `anon`/public read paths only through the existing public read function so unpublished windows never leak. Public consumers read a new `get_public_trainer_availability(_instructor_id, _from, _to)` SECURITY DEFINER function that filters to `is_public = true`, applies effective-date ranges, subtracts blocks, and returns the reason only when `is_public_reason` is true.
- Deleting a trainer permanently is done through a new admin-only RPC that refuses when dependent rows exist (`pt_appointments`, `pt_session_notes`, `class_sessions`, `class_schedules`, payroll rows) and returns a readable message.

Frontend:

- `src/pages/admin/PersonalTrainingTrainers.tsx`: add trainer create/edit sheet, row actions, show-inactive toggle; rewrite `AvailabilityEditor` (effective dates + public switch + labels) and `OverridesEditor` (date ranges, reason, public-reason switch).
- `src/hooks/pt/usePTTrainerProfiles.ts`: include the new availability fields in `usePTTrainerDetail`.
- Admin booking (`BookPTSessionDialog`) keeps seeing all windows, public and internal.
