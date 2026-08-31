# Class Studio Portal (Admin)

One destination for scheduling, rosters, waitlists and studio metrics — instead of jumping between Today's Classes, Class Management, Class Schedules and Roster.

## What exists today

- Rooms are free text on schedules/sessions. Live values: Reformer Studio (71), Cycle Studio (41), Aerobics Studio (31), plus one typo "REFOREMR STUDIO".
- Four separate pages: `/admin/classes` (today), `/admin/class-types`, `/admin/class-schedules`, roster on its own page.
- Sessions already carry room, capacity, enrollment, cancelled/hidden, invite-only, fundraiser, notes, price override.

## Mockup — Studio Grid (default view)

```text
CLASS STUDIO PORTAL          [ Grid | Week | List | Templates | Metrics ]
< >  Mon Sep 1, 2026  [Today]   Rooms: [All v]  Instructor: [All v]  [+ Add Class]
────────────────────────────────────────────────────────────────────────────
        REFORMER STUDIO        CYCLE STUDIO          AEROBICS STUDIO
        cap 8                  cap 10                cap 20
 6:00 ┌──────────────────┐
 6:30 │ Reformer 50      │  ┌──────────────────┐
 7:00 │ Sara K.  8/8 FULL│  │ Rhythm Ride      │
 7:30 │ wait 3           │  │ Mia R.   6/10    │
 8:00 └──────────────────┘  └──────────────────┘  ┌──────────────────┐
 8:30                                             │ Mat Pilates      │
 9:00 ┌──────────────────┐                        │ SUB: Dana  4/20  │
 9:30 │ Reformer Flow    │                        └──────────────────┘
10:00 │ (no instructor)⚠ │
      └──────────────────┘
 ...
────────────────────────────────────────────────────────────────────────────
Today: 9 classes · 71% fill · 4 waitlisted · 2 unstaffed ⚠ · 1 hidden
```

- Columns = studios, rows = time. Overlaps in one column are an instant visual conflict.
- Tile shows class, instructor (SUB badge when substituted), x/y filled, waitlist count, and flags (hidden, cancelled, invite-only, fundraiser).
- Drag a tile to a new time or another studio column to reschedule that one session (confirm dialog, notifies booked members).

## Mockup — Session side panel (click a tile, no page change)

```text
┌ Reformer 50 · Mon Sep 1 · 6:30–7:20 AM · Reformer Studio ────────── X ┐
│ Sara K. [Change] [Assign sub]     Capacity 8 [-][+]   8/8 · Wait 3    │
│ [Check-in] [Roster] [Waitlist 3] [Details] [History]                  │
│ ─────────────────────────────────────────────────────────────────────│
│ ✔ Malak B.        Gold        checked in 6:24a      [no-show][remove] │
│ ○ Jerica S.       Class pass  —                     [check in]        │
│ ✗ Amy T.          Gold        cancelled (late)                        │
│ + Add member / guest to this class                                    │
│ ─────────────────────────────────────────────────────────────────────│
│ [Cancel class] [Hide] [Invite-only] [Notes] [Message roster]          │
└───────────────────────────────────────────────────────────────────────┘
```

## Mockup — Metrics tab

```text
Range: [Last 30 days v]   Studio: [All v]
Fill rate 68%   Sessions 214   Bookings 1,412   No-show 6.1%   Waitlist 88

Fill by studio      Reformer ███████████ 84%
                    Cycle    ███████ 61%
                    Aerobics ████ 42%

Best / worst time slots        Instructor leaderboard
Tue 6:00a Reformer  97% ↑      Sara K.     88% · 2.1% no-show
Sun 4:00p Aerobics  19% ↓      Mia R.      64% · 7.8% no-show
                               (empty-seat cost + trend arrows per slot)
```

## Scope

**Phase 1 — Portal shell + Studio Grid**
- New route `/admin/class-studio` with tabs: Grid, Week, List, Templates, Metrics. Existing pages stay reachable; sidebar points here first.
- Day grid by studio column, with room/instructor/class-type filters and a "show cancelled/hidden" toggle.
- Session side panel with roster, check-in, no-show, add/remove attendee, waitlist promote, capacity change, cancel/hide/notes — all without leaving the grid.
- Normalize room values to a small studio list (fix "REFOREMR STUDIO"; rooms become a picker, not free text).

**Phase 2 — Control & speed**
- Drag-and-drop reschedule (time/studio) for a single session, with conflict guard.
- Substitute instructor for one date, preserving the schedule's instructor of record.
- Bulk actions: copy a week forward, mass-cancel a date range (holidays), bulk instructor swap, bulk capacity change.
- Quick "add one-off class" from an empty grid cell (pre-fills day/time/studio).

**Phase 3 — Templates & metrics**
- Templates tab: recurring rules grouped by studio and weekday with active date windows, clone-a-template, activate/deactivate, and the existing conflict panel folded in.
- Metrics tab: fill rate, no-show rate, waitlist demand, revenue per session, best/worst slots, instructor leaderboard, with CSV export.

## Technical notes

- New page `src/pages/admin/ClassStudio.tsx` plus components under `src/components/admin/class-studio/` (StudioGrid, SessionPanel, RosterList, TemplatesTab, MetricsTab). Existing `ClassRoster.tsx` logic is reused via extracted hooks rather than duplicated.
- All times computed in `America/Detroit`; tab/filter/date state stored in the URL so refresh and Back keep position.
- Room normalization is a data cleanup plus a `studios` lookup (or constant list) feeding the picker; sessions keep their `room` text for compatibility.
- Reschedule, sub-assign, bulk cancel and waitlist promotion go through RPCs so capacity, credits, refunds and notifications stay consistent with current booking rules; cancelled bookings remain visible greyed out with Early/Late labels.
- Metrics come from aggregate queries over `class_sessions` / `class_bookings` / `class_waitlist`, cached per range.
