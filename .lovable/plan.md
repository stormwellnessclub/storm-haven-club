# Personal Training Booking System (Admin)

Bring scheduling into the PT admin — pick a member, pick a trainer/time, book the session, auto-deduct from their pack, and email a confirmation with the 24-hour cancellation policy.

## What you'll see

On the existing **Personal Training** admin page, a new top-level tab/section called **Schedule**:

```text
[ Customers ]  [ Schedule ]  [ Packs ]

Schedule view
─────────────────────────────────────────────────────────
Date: [ Wed Jun 10 ▾ ]   Trainer: [ Any ▾ ]   Format: [ Any ▾ ]
                                              [ + Book session ]

Today's appointments
 09:00 AM  Faten Saad      1:1 w/ Jordan   ✔ 1 session deducted
 10:30 AM  Sarah K.        Reformer 1:1    ✔ 1 session deducted
 02:00 PM  (open)
```

### Book session dialog
1. Search customer (same picker as Sell PT).
2. Show their **active passes** inline:
   - "1:1 Personal Training — 7 of 10 sessions left, expires Jul 22"
   - If none: red banner **"No active sessions. Sell a pack first."** with a **Sell pack** shortcut.
3. Pick **format**, **trainer**, **date**, **start time**, **duration** (default 60 min).
4. Optional internal notes.
5. **Book & deduct** button → atomically creates the appointment, deducts 1 from the chosen pass (FIFO: soonest expiring active pass), logs to `pt_session_usage`, and sends the confirmation email.

### Appointment row actions
- **Cancel** (with reason) → restores the deducted session if cancelled ≥24h in advance; otherwise marks as late cancel and keeps the deduction. Sends cancellation email.
- **Mark no-show** → keeps deduction, flags appointment.
- **Reschedule** → moves time; no re-deduction.
- **Complete** (auto when time passes) → no change.

## Member portal

Booked PT sessions appear on `/portal/passes` under a new **Upcoming sessions** card showing date/time/trainer and a **Cancel** button (enforces 24-hour rule — late cancels lose the session).

## Confirmation email

Sent via the existing transactional email path. Subject: *"Your Personal Training session is booked"*. Body includes member name, format, trainer, date/time (America/Chicago), location, remaining sessions after deduction, and the cancellation policy:

> **Cancellation policy:** Free cancellation up to 24 hours before your session. Late cancellations forfeit the session from your pack.

A reschedule email and a cancellation email use the same template family.

---

## Technical details

**New table `pt_appointments`**
- `id`, `user_id`, `pass_id` (FK pt_passes), `instructor_id` (FK instructors, nullable for "any"), `format` (pt_format)
- `starts_at` (timestamptz), `ends_at` (timestamptz), `duration_minutes`
- `status`: `scheduled | completed | cancelled | late_cancel | no_show`
- `cancelled_at`, `cancelled_by`, `cancel_reason`
- `usage_id` (FK pt_session_usage, the deduction row)
- `booked_by_admin_id`, `notes`, timestamps
- RLS: members read own; staff (admin/super_admin/manager/front_desk) full access. GRANT to authenticated + service_role.

**New RPCs (SECURITY DEFINER)**
- `book_pt_appointment(p_user_id, p_format, p_instructor_id, p_starts_at, p_duration_minutes, p_notes)` — picks soonest-expiring active pass matching format with `sessions_remaining > 0`, decrements it, inserts `pt_session_usage`, inserts `pt_appointments`, returns the appointment row + new balance. Raises if no eligible pass.
- `cancel_pt_appointment(p_appointment_id, p_reason)` — if `now() < starts_at - interval '24 hours'`: restore session (increment pass, delete usage row, status=`cancelled`); else status=`late_cancel` keep deduction. Members can cancel their own; staff can cancel anyone.

**Edge function: `send-pt-booking-email`**
- Inputs: appointment id, type (`confirmation | cancellation | reschedule`).
- Pulls member email + appointment details, renders template, queues via existing transactional email infra.
- Called from `book_pt_appointment` trigger (or from the client after the RPC succeeds — simpler, no DB→HTTP).

**Frontend**
- New file `src/pages/admin/PersonalTrainingSchedule.tsx` (Schedule tab).
- New `src/components/admin/BookPTSessionDialog.tsx`.
- Add `Schedule` / `Customers` tabs to `PersonalTrainingPasses.tsx` (or rename page to `PersonalTraining.tsx` with sub-tabs).
- Portal: add `UpcomingPTSessions` card to `MyPTPassesSection.tsx` with cancel button calling the RPC.

**Out of scope** (can be follow-ups)
- Trainer availability windows / conflict checks (we'll allow any time and just warn if same trainer already booked).
- Recurring/series bookings.
- SMS reminders.

## Open questions
1. Should the system **prevent double-booking the same trainer** at the same time, or just warn?
2. Default session duration — **60 minutes** for 1:1 and Reformer, **45 min** for semi-private — confirm?
3. Should members be able to **book themselves** from the portal, or admin-only for now?
