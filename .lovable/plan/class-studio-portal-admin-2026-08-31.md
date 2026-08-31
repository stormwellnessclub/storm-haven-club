# Class Studio Portal (Admin)

One destination for planning, scheduling, staffing, rosters and studio metrics — instead of jumping between Today's Classes, Class Management, Class Schedules and Roster.

## Research: what top-rated studio systems do

Reviewed the admin scheduling experience of Mariana Tek, Momence, Arketa, WellnessLiving, Mindbody, Pike13, zingfit and Xplor Studio.

Table stakes they all have and we don't:
- Recurring "series" templates with edit-this-occurrence vs edit-entire-series.
- One-off overrides layered on a series without breaking the template.
- Substitute instructor for a single date, preserving the instructor of record for pay/history.
- Roster/check-in slide-out panel from the calendar (no page change).
- Capacity + waitlist shown on the calendar tile ("8/8", "wait 3").
- Waitlist auto-promotion when a spot frees up.
- Bulk publish/unpublish and copy-a-week-forward.

Differentiators worth copying (this is where the month-planning pain gets solved):
- Resource/room columns side by side (Mariana Tek, zingfit) so conflicts are visible instantly.
- Drag-and-drop scheduling and rescheduling directly on the calendar (Momence, Mariana Tek).
- A draft/publish workflow: build next month, review, then publish in one action.
- Instructor coverage view — hours per instructor per week, conflicts, unstaffed classes flagged.
- Bulk actions: mass-cancel a date range (holidays), bulk instructor swap, bulk capacity change.
- Utilization analytics by class type / instructor / time slot to prune the schedule.
- Booking-window controls per template (how far ahead members can book).

## Mockups

Two mockups accompany this plan: the **Day Grid** (studio columns + roster panel) and the **Month Planner** (template palette, drag-to-day, instructor coverage, publish draft).

## What exists today

- Rooms are free text on schedules/sessions. Live values: Reformer Studio (71), Cycle Studio (41), Aerobics Studio (31), plus one typo "REFOREMR STUDIO".
- Four separate pages: `/admin/classes` (today), `/admin/class-types`, `/admin/class-schedules`, roster on its own page.
- `class_sessions` already carries room, capacity, enrollment, cancelled/hidden, invite-only, fundraiser, notes, price override.

## Scope

**Phase 1 — Portal shell + Day Grid**
- New route `/admin/class-studio` with tabs: Day Grid, Week, Month Planner, Templates, Metrics. Sidebar points here first; old pages stay reachable.
- Day grid with one column per studio, time axis, filters (studio, instructor, class type), toggle for cancelled/hidden.
- Session slide-out panel: roster, check-in, no-show, add walk-in, waitlist promote, capacity change, cancel/hide/notes, message class — all without leaving the grid.
- Normalize rooms into a studio list (fix "REFOREMR STUDIO"); room becomes a picker, not free text.

**Phase 2 — Month Planner (the monthly scheduling workflow)**
- Month calendar with a left palette of class templates (class type + default instructor + duration + studio). Drag a template onto a day to schedule it; drag within the calendar to move it.
- Draft mode: everything you add/move/remove stays unpublished until "Publish" — with a change counter and a review list. Members never see half-built months.
- Instructor coverage rail: hours per instructor for the visible week, conflicts, and unstaffed-class flags.
- Bulk tools: Copy Week Forward (into the next N weeks), Bulk Assign Instructor over a date range, Mass Cancel Range for holidays, bulk capacity change.
- Assign a substitute for one date without changing the recurring rule.

**Phase 3 — Templates & metrics**
- Templates tab: recurring rules grouped by studio and weekday with their active date windows, clone-a-template, activate/deactivate, booking-window setting per template, and the existing conflict panel folded in.
- Metrics tab: fill rate by studio/class type/time slot, no-show rate, waitlist demand, revenue per session, instructor leaderboard, best/worst slots, CSV export.

## Technical notes

- New page `src/pages/admin/ClassStudio.tsx` with components under `src/components/admin/class-studio/` (StudioDayGrid, SessionPanel, MonthPlanner, TemplatePalette, CoverageRail, TemplatesTab, MetricsTab). Roster logic reused from `ClassRoster.tsx` via extracted hooks rather than duplicated.
- Draft/publish adds a staged-change layer for planned sessions (draft rows plus a publish RPC) so nothing reaches members until published.
- All times in `America/Detroit`; tab, date and filter state kept in the URL so refresh and Back keep position.
- Move, sub-assign, bulk cancel and waitlist promotion go through RPCs so capacity, credits, refunds and notifications match current booking rules; cancelled bookings stay visible greyed out with Early/Late labels.
- Metrics from aggregate queries over `class_sessions`, `class_bookings`, `class_waitlist`, cached per range.
