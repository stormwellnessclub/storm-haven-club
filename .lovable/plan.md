# Make the "6 duplicate schedules" alert understandable

## What the alert actually means today

The panel on Admin → Class Schedules compares every active recurring schedule against every other one. When two land on the same weekday, same room, and the exact same start and end time, it counts that pair as one "Duplicate". Pairs, not entries — which is why three copies of one class produce three alerts and the number feels inflated.

Your current 6 alerts come from 4 real problem slots:

```text
Sunday 11:00-11:50 AM  Reformer Studio  Bea M   -> 3 copies  (3 alerts)
  Reformer Sculpt Adv/Int (Heated)  x2 + Reformer Sculpt Adv/Int x1
Tuesday 7:00-7:50 PM   Reformer Studio  Bea M   -> 2 copies  (1 alert)
  Reformer Sculpt All Levels + Reformer Sculpt Adv/Int
Thursday 11:00-11:50 AM Aerobics Studio Bea M   -> 2 copies  (1 alert)
  Mat Pilates + Mat Pilates
Thursday 12:00-12:50 PM Reformer Studio Bea M   -> 2 copies  (1 alert)
  Reformer Sculpt Adv/Int (Heated) + Signature Flow
```

Some copies already carry bookings, so this is not a case of "just delete the newer one" — the panel has to show you that.

## The change

Rewrite the alert as a grouped, plain-English panel:

- One card per time slot, not per pair. Header reads like: "Thursday 12:00 PM - Reformer Studio - 2 classes scheduled in the same room".
- Under it, one row per schedule entry showing: class name, instructor, upcoming session count, and total bookings on its sessions.
- Rows with bookings get a "Has bookings - do not delete" note; rows with zero bookings get a "Safe to remove" note and an inline Deactivate button.
- Keep the existing Edit pencil per row.
- Header count changes from "6 conflicts detected" to "4 time slots have overlapping classes" so the number matches what you see.
- Instructor double-bookings and non-identical room overlaps keep their own separate cards, with wording that names the actual problem ("Bea M is teaching two classes at once") instead of the generic Duplicate badge.
- Add a one-line explainer at the top of the panel: what counts as a conflict and that removing a duplicate does not delete past attendance.

No data is changed as part of this — cleanup stays a decision you make per row from the panel.

## Technical notes

- `src/lib/scheduleConflicts.ts`: return grouped clusters (key = day + start + end + room) instead of flat pairs; keep instructor-overlap and partial room-overlap detection as separate result types.
- `src/components/admin/ScheduleConflictPanel.tsx`: render clusters, wire a per-schedule Deactivate action (sets `is_active = false`) and the existing edit handler.
- Booking/session counts per schedule come from a small aggregate query on `class_sessions` joined to `class_bookings`, keyed by `schedule_id`, fetched in `src/pages/admin/ClassSchedules.tsx` and passed into the panel.
- Deactivating a schedule leaves already-generated future sessions in place; the reconcile function handles them on the next run.
