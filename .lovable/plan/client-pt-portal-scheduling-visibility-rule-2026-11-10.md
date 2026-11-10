# Client PT Portal — Scheduling Visibility Rule

Online PT requesting and booking stay off. Clients keep seeing their own PT information and never see trainer schedules.

## What I found
- Member and non-member dashboards already show the client's own upcoming PT sessions and PT packages.
- The "Request a PT Session" card currently **disappears entirely** when online booking is off, instead of showing "Coming Soon".
- Trainer hours, time off, blocks and the PT waitlist are already staff-only in the database.
- **Privacy gap:** one booking-check function still lets a signed-in client check a time for themselves. Its answer includes the trainer's conflicts, time off and the reasons a time is blocked. This must close.
- Client request submission is already blocked while booking is off. The public "ask about personal training" form on the website is a contact form, not a booking. It stays as is.

## Changes
1. **"Request / Book a Session — Coming Soon"** on the member and non-member dashboards for PT clients. It's a non-clickable button with a short line such as "Online scheduling is coming soon. Message us or ask your trainer to book." It opens nothing.
2. **Close the client path in the booking check** so only staff can run it. Clients get "Not authorized". Staff booking is unchanged.
3. **Audit every PT scheduling function** (available times, trainer day windows, waitlist matches, eligible trainers, readiness) to confirm each one refuses clients. Close any that don't.
4. **Hard lock until you approve.** The request-submission function refuses clients outright, whatever the booking-mode setting says. Turning it on later needs your sign-off and a separate change.
5. **Client views keep showing only their own data**: upcoming and past sessions, sessions left, packages and expiry, billing, payment plan and next autopay, payment history, and assigned trainer (name only). I'll check that the client's appointment view never shows internal notes or conflict reasons.
6. **Future rule recorded:** when scheduling opens, clients get only a list of safe open times (e.g. "Tue 10:00 AM"), never the trainer calendar.

## Verification
- Signed in as a client: the Coming Soon button shows and does nothing. Each scheduling function returns "Not authorized". The client's own sessions and packages still load.
- Staff booking still works (PT tests plus a database check).
- No PT records changed.

2D.4 is not started.

## Technical details
- Migration: `pt_check_slot` drops the `p_user_id = auth.uid()` branch (staff/desk only). `pt_request_create` raises `CLIENT_SCHEDULING_NOT_ACTIVE` for non-staff callers. Same guard on any audited function that lacks `pt_is_staff_or_desk`.
- `PTSessionRequestCard`: when `is_client`, render the disabled Coming Soon state instead of `return null`; drop the form path for now.
- Review `UpcomingPTAppointmentsCard` and `MyPTPassesSection` selects so they omit staff-only columns.
- Add an AGENTS.md rule: client PT roles receive derived safe slots only; no trainer calendar API for client roles.
