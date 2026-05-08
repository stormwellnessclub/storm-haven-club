## Goal
Open Teresa's massage schedule for **Sunday, May 10, 2026 only** (Mother's Day), 10:00 AM – 8:00 PM, without changing her regular weekly availability.

## Problem
Today, `spa_service_availability` only supports recurring weekly schedules via `day_of_week`. Adding Sunday rows would open **every** Sunday forever. We need a one-off date opening.

## Solution

### 1. Schema: add one-off date support (migration)
Add a nullable `specific_date date` column to `spa_service_availability`.
- When `specific_date IS NULL` → behaves as today (recurring weekly by `day_of_week`).
- When `specific_date IS NOT NULL` → row only applies on that exact calendar date (and `day_of_week` is ignored for matching).

Add an index on `specific_date` for fast lookups.

### 2. Booking/availability logic
Update `src/lib/spaAvailability.ts` (the 4 filters that currently match on `day_of_week === dow`) to also accept a row when `specific_date === <selected date in YYYY-MM-DD>`. Existing recurring rows continue working unchanged.

### 3. Admin UI (small)
In `SpaAvailabilityTab.tsx`, add an optional "Specific date (one-off)" date picker on the create/edit form. If filled, the row is treated as one-off and the day-of-week selector is disabled. Existing rows render normally.

### 4. Seed Teresa's Mother's Day openings (data insert, after migration)
Insert 10 one-off rows (one per massage service Teresa offers — 5× 60-min and 5× 90-min), all with:
- `therapist_id` = Teresa
- `room_id` = her existing massage room (`a685cf00-…`)
- `specific_date` = `2026-05-10`
- `start_time` = `10:00`, `end_time` = `20:00`
- `is_active` = true, `max_bookings` = 1

The booking engine already enforces "appointment + cleanup must fit inside the window," so the last 60-min slot will auto-cap at 18:45 (or 19:00 if no cleanup) and the last 90-min slot at 17:30 — exactly as you described, with no extra config.

### Out of scope
- No changes to her existing Mon–Sat schedule.
- No facials/waxing — massages only (matching her current Thu/Fri service set).
- This Sunday only; future Sundays remain closed.

### Files touched
- `supabase/migrations/<new>.sql` — add column + index
- `src/lib/spaAvailability.ts` — date-match filter
- `src/hooks/useSpaManagement.ts` — type update
- `src/components/admin/spa/SpaAvailabilityTab.tsx` — optional date field
- Data insert for the 10 Sunday rows
