# Phase 2D.3 — PT Trainer Availability + Bookable-Time Engine

Client PT booking stays OFF the whole time. Clients see nothing new.

## What you'll get (staff side only)
- Trainer weekly hours (several time blocks per day, days off) on the existing trainer screen.
- One-day changes ("Nov 23 off", "Nov 30 10–4") that don't touch the normal week.
- Time off that actually stops booking: full day, part day, or several days.
- PT schedule shows each time as Available / Confirmed / Pending requests / Time off / Outside hours / Blocked / Room unavailable, plus Capacity, Confirmed, Pending and Open spots for group sessions.
- Request list sortable oldest-first, showing client, submitted time, preferred trainer/date/time, availability window, flexibility, session type, capacity and status. Queue position is never shown to clients.
- PT waitlist: add a client with their preferences. It never creates an appointment. When a spot opens (including from a cancellation), staff see matching waitlisted clients. Nothing is sent automatically.
- Trainer readiness card for each trainer: hours set, upcoming availability, time-off conflicts, booking setting, then Ready or Not Ready. It never turns booking on.
- Override: admins/managers can book outside the rules only with an explicit Override button and a reason. Who did it and when is saved.

## Rules the engine enforces
- The whole session must fit inside the trainer's hours. Partial fits are not offered.
- Only confirmed bookings use up spots. Pending requests don't, and cancelled ones free the spot.
- Capacity comes from each session type (Private 1, Semi-private 4, and so on).
- No trainer double-booking beyond capacity, and no client in two overlapping PT sessions.
- Room/location limits are applied only where the current PT setup already records them. The report will explain how this works today.
- Requests keep the requested time and the confirmed time separately. Staff may confirm another time inside the client's own window. A time outside it becomes "alternate offered" and needs the client to agree.

## Technical details
- Reuse `pt_trainer_availability`, `pt_trainer_overrides` (exceptions/time off), `pt_trainer_locations`, `pt_session_types.capacity`, the existing group-occupancy/conflict check, and `training_requests`. No second availability system.
- New server function `pt_available_slots(trainer, date range, session_type, client?)` plus `pt_check_slot(...)`. This is the one engine. `book_pt_appointment`, request confirm/convert, reschedule and trainer change all call `pt_check_slot`, and the screens only display what it returns.
- Additive migration only: request window columns (earliest/latest time, flexibility, requested vs confirmed time, outcome event type for future messages), `pt_waitlist` table with grants and staff-only rules, and override audit columns (reason, actor, timestamp). Existing appointments are not changed.
- `pt_instant_booking_ready()` stays false, and the global setting stays OFF.
- Tests: logic tests for slot fitting/capacity/windows, plus acceptance checks A–P run on throwaway records inside rolled-back transactions. No real clients are contacted and no live records are altered.
- Deliverable: the short PASS/FAIL report in your exact format, ending "PHASE 2D.3 STATUS: COMPLETE". Then stop, with no 2D.4.
