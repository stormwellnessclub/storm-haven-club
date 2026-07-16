# Flexible Class Scheduling: Recurring, Duration, One-Time

Extend the Admin → Class Schedules page so each entry can be created in one of three modes instead of only "recurring weekly forever."

## Modes

1. **Recurring (ongoing)** — current behavior. Every week on that day/time until deactivated.
2. **Recurring for a duration** — same as above, but bounded by a start date and end date. Auto-stops generating after end date.
3. **One-time only** — a single session on a specific date. Not added to the weekly recurring loop.

## UX (Admin → Class Schedules dialog)

Add a "Schedule type" segmented control at the top of the new/edit dialog:

```text
( ● Recurring ongoing ) ( ○ Recurring for a period ) ( ○ One-time )
```

- **Recurring ongoing**: shows Day of week + times (current form).
- **Recurring for a period**: adds Start date + End date pickers below Day of week. Day of week required.
- **One-time**: replaces Day of week with a single Date picker. Auto-derives day_of_week from the chosen date. Skips conflict-check across future weeks.

List view: badges next to each schedule — "Ongoing", "Thru MMM D", or "One-time MMM D, YYYY". One-time schedules that have already run are collapsed under a "Past one-time classes" section.

## Data model (schema migration)

Add three nullable columns to `public.class_schedules`:

- `effective_from date` — inclusive start (null = no lower bound; keeps existing rows working).
- `effective_until date` — inclusive end (null = ongoing).
- `is_one_time boolean not null default false` — flags one-time entries; when true, `effective_from = effective_until = the single date`.

No data backfill needed — existing rows read as "ongoing" (both dates null).

## Session generation

Update `reconcile_and_generate_class_sessions` RPC so that when it iterates candidate dates for a schedule:

- Skip dates before `effective_from` (when set).
- Skip dates after `effective_until` (when set).
- For `is_one_time = true`, only emit exactly one session on `effective_from`.

Deactivation of expired schedules: after generation, mark `is_active = false` where `effective_until < today` so the list auto-tidies.

## Frontend files touched

- `src/pages/admin/ClassSchedules.tsx` — mode toggle, date pickers, conditional form fields, list badges, past one-time collapse.
- `src/lib/scheduleConflicts.ts` — conflict check respects effective window (only compare overlapping date ranges; one-time vs recurring only conflicts if the recurring rule covers that date).
- `src/integrations/supabase/types.ts` — regenerated automatically after migration.

## Out of scope

- No changes to member-facing schedule browser (already reads from `class_sessions`, so it will just show what's generated).
- No bulk migration of the existing one-off sessions you inserted directly into `class_sessions` — those keep working as-is.

## Technical notes

- Migration order: add columns → update RPC → add index on `(effective_until)` for the auto-deactivate sweep.
- GRANTs: `class_schedules` already has row policies; new columns inherit table grants, no new GRANT needed.
- Timezone: date comparisons in the RPC continue to use `America/Detroit` via the existing `club_today()` helper.
