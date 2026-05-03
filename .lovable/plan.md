## Plan: Add one-time class session

Insert a single non-recurring session into `class_sessions`:

- **Date**: 2026-05-03
- **Time**: 12:00 – 12:50 PM
- **Class type**: Reformer Sculpt – Adv/Int (Heated) (`86348f0e-9025-4fac-b195-89a0e536216a`)
- **Instructor**: Duha A (`284f1cc6-d989-4d63-8825-6b8cfa9e2987`)
- **Room**: Reformer Studio
- **Max capacity**: 8 (matches existing Reformer Sculpt sessions)
- **schedule_id**: NULL (one-time, not tied to recurring schedule, so reconciliation won't touch it)
- `is_cancelled=false`, `is_hidden=false`, `current_enrollment=0`

This will appear immediately on the public schedule and member booking pages, and members can book it normally.

### Technical detail
Single INSERT into `public.class_sessions` via the insert tool. No schema changes, no code changes.