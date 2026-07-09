## Plan: add three one-off classes

Insert three standalone rows into `class_sessions` with `schedule_id = NULL` and no instructor (blank, per your recent preference — you'll assign later). No recurring schedule created, so they won't repeat.

### Sessions

| Date | Class | Time | Room | Capacity |
|---|---|---|---|---|
| Tue 7/14/2026 | Signature Flow Pilates – All Levels (Heated) | 7:00 PM – 7:50 PM | Reformer Studio | 8 |
| Wed 7/15/2026 | Mat Pilates | 12:00 PM – 12:50 PM | Aerobics Studio | 8 |
| Fri 7/17/2026 | Reformer Sculpt – Adv/Int (Heated) | 12:00 PM – 12:50 PM | Reformer Studio | 8 |

All 50-minute durations matching each class type's standard. Instructor left blank on all three.

### Guardrails
- `schedule_id` explicitly `NULL` so `reconcile_and_generate_class_sessions` won't touch or hide them.
- `is_hidden = false`, `is_cancelled = false` so they show on the public schedule and are bookable immediately.

Approve and I'll insert the three rows.