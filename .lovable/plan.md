
## What's actually going on

I dug into the database and the two things you're seeing have separate causes.

### 1. The mystery Aug 10 classes (and many others)

There are **36 sessions on the public schedule that have no `schedule_id`** — meaning no parent row in Class Management. That's why you can't find or edit them. They were auto-generated back in May–July by an older cron job that then had its schedule row deleted, orphaning the sessions.

Examples:
- Sun Aug 10, 9:00am — Reformer Sculpt (no instructor)
- Sun Aug 10, 9:00am — Reformer Sculpt – Adv/Int (Heated) (no instructor)
- Sun Aug 10, 10:00am — Signature Flow
- Mon Aug 11 / Wed Aug 12 / Aug 17 / Aug 18 / … through Sept 29

Almost all are 0-booking Reformer/Heated 9am sessions. **One has bookings**: Sun Jul 27, 10am Signature Flow (2 attendees) — we'll preserve that one.

### 2. Why the schedule "stops after Aug 17"

Sessions actually exist all the way through **Sept 29** in the database. The public/member `ScheduleBrowser` is hard-capped at **current week + 3 more weeks** (Monday start). Today is Fri Jul 24, so the last visible week is Aug 10–16 → the schedule visually ends Sun Aug 16 / Mon Aug 17. That's the "4-week booking window" you set up earlier — working as coded, but the label doesn't make it obvious *why* it stops.

---

## Plan

### Step 1 — Clean up orphan sessions (data fix)

Migration that runs once:
- **Delete** all `class_sessions` where `schedule_id IS NULL`, `session_date >= today`, and there are zero confirmed bookings (35 rows).
- **Leave alone** the Jul 27 Signature Flow session with 2 attendees. It stays visible; the 2 members keep their booking.
- Add a NOT-NULL-ish safety: change the `schedule_id` foreign key to `ON DELETE CASCADE` so if a schedule is ever deleted again, its sessions go with it instead of being orphaned.

### Step 2 — Give admin a way to find/remove one-offs going forward

In `src/pages/admin/ClassSchedules.tsx` add a small **"Orphan sessions"** panel (only shown when count > 0) that lists any session with no parent schedule and gives you a per-row **Delete** button. So this never becomes a mystery again.

### Step 3 — Make the 4-week booking window obvious

In `src/components/booking/ScheduleBrowser.tsx`:
- Show a persistent header line: **"Booking open through Sun, Aug 16. Next 4 weeks release Mon, Aug 17."** (dates roll forward automatically).
- When you're on the last visible week, replace the disabled "next" arrow with a soft card: *"More classes release next Monday — check back then."*
- Optional toggle we can add if you want: bump the window from **4 weeks → 5 or 6 weeks**. My recommendation is to keep it at 4 so members book near-term and no-shows drop; but easy to change — let me know.

### Step 4 — Admin can see further than members

In the admin `WeeklyCalendarView` you already can scroll past the 4-week cutoff. I'll add a subtle **"Public booking cutoff: Aug 16"** marker line on the calendar so you always know where the member-visible edge falls when you're building future weeks.

---

## Technical notes

- Orphan cleanup runs as a single migration with a `WHERE schedule_id IS NULL AND session_date >= CURRENT_DATE AND NOT EXISTS (SELECT 1 FROM class_bookings WHERE session_id = class_sessions.id AND status='confirmed')` guard.
- The FK change: `ALTER TABLE class_sessions DROP CONSTRAINT class_sessions_schedule_id_fkey, ADD CONSTRAINT ... FOREIGN KEY (schedule_id) REFERENCES class_schedules(id) ON DELETE CASCADE`.
- Booking cutoff currently: `startOfWeek(addWeeks(today, 3), { weekStartsOn: 1 })`. Label will be derived from `endOfWeek(maxWeekStart, { weekStartsOn: 1 })` so it stays in sync if we ever change the window size.

---

## Please confirm before I build

1. **OK to delete the 35 empty orphan sessions** and keep the Jul 27 Signature Flow one (which has 2 bookings)?
2. Keep the booking window at **4 weeks**, or bump to 5 or 6?
