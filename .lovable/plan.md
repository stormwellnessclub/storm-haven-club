## Problem

On mobile widths (like your current 545px preview), the **Schedule type** segmented toggle in the "New Schedule" dialog sits in the middle of a long form, below Class Type / Instructor, and renders as three small grey text buttons inside a thin `bg-muted/30` bar. It's easy to scroll right past it — which is why it looks like the options aren't there at all. The code path is wired correctly (fields, save, and the session generator all honor `is_one_time` / `effective_from` / `effective_until`), so this is a discoverability problem, not a data problem.

## Fix

Rebuild the top of the dialog so the schedule type is the **first, largest** decision, not a subtle segmented control buried mid-form.

**In `src/pages/admin/ClassSchedules.tsx`, restructure the New/Edit Schedule dialog:**

1. **Move "Schedule type" to the very top of the dialog, above Class Type.**
2. Replace the tiny segmented toggle with **three large tap-target cards** stacked (mobile) / in a row (desktop):

   ```text
   ┌──────────────────────────────┐
   │ 🔁 Recurring                 │  ← Repeats weekly, no end date
   ├──────────────────────────────┤
   │ 📅 For a period              │  ← Repeats weekly between two dates
   ├──────────────────────────────┤
   │ ⭐ One-time                   │  ← Single session on one date
   └──────────────────────────────┘
   ```

   Each card: icon + bold title + one-line description. Selected card = solid primary border + subtle bg tint. Full-width, min 56px tall so they're impossible to miss.

3. **Conditionally reveal the correct date fields directly under the picker** so it's visually obvious what changes:
   - Recurring → Day of Week only
   - For a period → Day of Week + Start Date + End Date (in a highlighted panel)
   - One-time → single Date field (in a highlighted panel)

4. Widen the dialog to `sm:max-w-[560px]` and add `max-h-[90vh] overflow-y-auto` so the whole form is reachable on a phone.

5. Also add a compact `TypeBadge` (Recurring / Period / One-time) to each row of the existing Schedules table so once created, one-time and dated schedules are visually distinguishable at a glance.

## No backend changes

The DB already supports all three modes:
- `class_schedules.is_one_time`, `effective_from`, `effective_until` exist
- `reconcile_and_generate_class_sessions` already filters on those fields (verified in the latest migration)
- Save mutation already sets them correctly

So this is a **UI-only change** to `src/pages/admin/ClassSchedules.tsx`. No migrations, no edge functions.

## Out of scope (ask if you also want these)

- Adding a "Quick add class" button on the `/admin/classes` day view
- Multi-day recurring (e.g. Mon+Wed+Fri in one rule) — currently one weekday per schedule
