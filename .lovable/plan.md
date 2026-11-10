# Phase 2D.3 — PT Roster + Gym-Floor Correction, then Runtime Verification

2D.4 will not be started.

## What I found
- PT trainer lists currently pull from the full instructor roster (13 people, incl. Maya, Jennie, Lauren, Summer, Duha, "Sub", "Storm Admin").
- A per-trainer service list already exists in the database but is empty for everyone, so nothing restricts who shows up.
- Service types today: Personal Training, Reformer 1:1, Semi-Private (capacity 4), Assessment, Consultation. **There is no Mat Pilates service yet.**
- Room clashes currently count as an un-overridable PT collision.
- Duha has 3 past PT appointments; Storm S 174; Klaudia 123. All stay untouched.

## Changes
1. **Gym floor, no room clashes for PT** — room clashes stop blocking PT bookings and reschedules. Hard blocks stay: trainer already booked, client already booked, Semi-Private full (only service with real capacity). Class/spa room logic untouched.
2. **PT eligibility from the existing per-trainer service list** (no names hard-coded in screens):
   - Storm S, Klaudia → Personal Training, Semi-Private, Assessment, Consultation.
   - Bea → Reformer 1:1 and a new **Mat Pilates 1:1** service (added, request-only).
   - Everyone else → no PT eligibility. Instructor records, class schedules, payroll and history unchanged.
3. **Bea request-only** — Reformer and Mat Pilates marked request-appointment-only; staff confirm/offer alternate via existing PT Requests. Global client booking stays OFF.
4. **Selectors switched to eligibility**: Sell PT Package, Book PT Session, PT Requests, Reschedule, Change Trainer, client trainer assignment, Trainer availability, Waitlist matching, PT report trainer filters. Lists filter by the chosen service. Past appointments with a now-ineligible trainer (e.g. Duha) still display their name.
5. **Classes untouched** — class instructor pickers keep reading the full roster, so Storm and Klaudia remain class instructors.

## Then: runtime verification
Sign in as an admin (you'll get an approval card to pick the account), create clearly labeled test bookings, run every 2D.3 check plus A–G from your brief, cancel test bookings. No charges, texts or emails. Return:
PT Room Logic / PT Trainer Roster / Class Instructor Preservation / Bea Service Eligibility / Bea Request-Only Rule — PASS/FAIL, then the remaining 2D.3 checks.

## Technical details
- Migration: `pt_slot_hard_conflict` drops `room_conflicts`; add `request_only boolean default false` to `pt_session_types`; insert `mat_pilates` type (format reformer_one_on_one-equivalent or new value — use one_on_one with `request_only=true`); add `pt_trainer_services(instructor_id, session_type_id)` with grants/RLS (staff read, admin write) since `pt_trainer_formats` is format-level and can't separate Bea's Reformer from general PT; seed rows above. `book_pt_appointment` rejects ineligible trainer for the service and rejects client-initiated booking of request-only types.
- Shared hook `usePTEligibleTrainers(sessionTypeId?)` used by all PT selectors; tests in `src/lib/ptAvailability.test.ts` for room-not-hard and eligibility filtering.
