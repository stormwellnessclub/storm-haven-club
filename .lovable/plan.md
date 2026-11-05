# Make "Plan My Week" an interactive wellness planner

Today the planner is one dropdown per day (a saved workout, rest, class, or cardio) plus notes. It doesn't cover recovery, has no times, no reminders, and nothing shows how the week is going. This plan turns it into a planner members use every day.

## What members will see

**1. Week at a glance**
- A row of 7 day "chips" (Mon–Sun) across the top with colored dots for each planned item; tap a day to open it.
- A weekly progress ring: "4 of 6 planned done", plus small counts for Training, Recovery, Classes, Rest.
- "Today" opens by default and shows what's next.

**2. Richer things to plan (each with an optional time)**
- Training: one of their saved workouts, a preset program day, or a custom note-only session.
- Club classes: picks from the real class schedule for that day; if already booked it appears automatically with a "Booked" tag. Unbooked picks show a "Book this class" button that opens the normal booking.
- Recovery: Red Light, Cryo, Salt Room, Sauna/Steam (wet spa), Cold plunge, Massage, Stretch, Mobility, Foam rolling, Meditation/breathwork. Their real spa/recovery bookings show automatically as "Booked".
- Habits: water, sleep, steps, protein — simple daily check-off.
- Rest day, Cardio/walk (kept).

**3. Interactive day view**
- Each item is a card with a time, icon, a big check-off button, and swipe/tap actions: Done, Skip, Move to another day, Edit.
- Workouts keep the "Start this workout" guided player; finishing marks the plan item done.
- Quick "+ Add" sheet with large icon tiles instead of a dropdown.
- Optional mood/energy check (1–5) and a short daily note.

**4. Smart suggestions (rule-based, no AI guessing)**
- After a hard training day: "Add recovery tomorrow?" with one-tap Red Light / Stretch / Sauna.
- No rest day planned this week: gentle prompt to add one.
- "Copy last week" stays; add "Use a starter week" templates (e.g. 3-day strength + 2 recovery).

**5. Reminders**
- Per item toggle: remind me 15 min / 1 hr / morning-of.
- Delivery: in-app reminder banner always; text message only for members who have given text consent (existing consent rules apply, opt-out always wins). Booked classes/spa keep their existing club reminders, so we won't double-text those.
- Optional daily "Here's your plan for today" morning text at a time they choose (off by default).
- Reminders cap: at most 3 texts per member per day.

**6. Streaks & wins**
- Weekly streak ("3 weeks in a row hitting your plan") and a simple end-of-week summary card.

## Not included
- No AI-generated plans or stock imagery.
- Push notifications to the phone lock screen aren't set up yet; texts + in-app are used instead.

## Technical details
- Extend `workout_plan_entries`: `category` (training/class/recovery/habit/rest/cardio), `activity_key`, `start_time` (Detroit wall time), `duration_min`, `reminder_offset_min`, `class_session_id`, `spa_appointment_id`, `skipped_at`, `completed_at`, `sort_order`. Keep existing rows working (category inferred from label/template).
- New `workout_day_checkins` (user_id, date, mood, energy, note, habits jsonb) and `workout_reminder_prefs` (daily summary on/off, time). RLS: owner only; grants per schema rules.
- Read-only merge of the member's real class bookings and spa/recovery appointments for the week (no duplicates; booked items not editable here, link to their booking).
- Reminders: scheduled via self-removing one-time timers created when an item with a reminder is saved/changed (never polling), sending through `send-sms` with consent checks and per-day cap; dedupe key per entry. Skip entries tied to club bookings that already get reminders.
- Logic in `workoutJournal.ts` (week stats, streaks, suggestion rules, Detroit time handling) with unit tests: streak counting, suggestion triggers, reminder time calc across DST, 3/day cap.
- UI: rebuild `src/components/member/WeekPlanner.tsx` into day strip, day view, add sheet, item card; mobile-first at ~400px.
- Testing: test texts only to a staff test number; no real member contacted.
