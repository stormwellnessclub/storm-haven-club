# Spa availability: remove Teresa's Tuesday, add one-off dates

## 1. Remove Teresa's Tuesday availability

Teresa Tyler currently has a recurring Tuesday window, 4:00pm–7:00pm, covering 12 massage services (Spa Room 5). There are no upcoming Tuesday appointments booked with her, so removing it affects nothing already scheduled.

Action: delete those 12 Tuesday windows. Her Thursday, Friday and Saturday recurring windows stay untouched.

## 2. One-off availability in the admin UI

The availability form today only offers a weekday. It will gain a mode switch:

- **Weekly (recurring)** — today's behavior, pick one or more days.
- **One-off date** — pick a calendar date instead; the window applies only to that date.

One-off windows appear in the availability list with the date shown (e.g. "Sun Sep 13") instead of a weekday badge, sorted with the other windows, and can be edited or deleted the same way. Conflict checking (same therapist or same room overlapping) runs for the chosen date as well.

The booking side already understands date-specific windows, so these appear on the public/admin booking calendars immediately for that date only.

## 3. Add September 13 one-off windows

For Sunday, September 13, 2026, 10:00am–7:00pm:

- **Teresa Tyler** — all 12 massage services she offers, Spa Room 5.
- **Arleacia Parker** — all 6 massage services she offers (Deep Relief 60/90, Sports Performance 60/90, Storm Signature 60/90), Spa Room 3 so the two therapists don't collide on one room.

## Technical notes

- Data change (migration): delete `spa_service_availability` rows where `therapist_id` = Teresa and `day_of_week = 2` and `specific_date is null`; insert 12 rows for Teresa and 6 rows for Arleacia with `specific_date = '2026-09-13'`, `start_time '10:00'`, `end_time '19:00'`, `is_active true`, rooms as above. `day_of_week` is stored alongside as the date's DOW (0) for consistency with existing one-off rows.
- Frontend: `src/components/admin/spa/SpaAvailabilityTab.tsx` — add a Recurring / One-off toggle to the form, a date picker bound to `specific_date`, clear `specific_date` when switching back to recurring, render the date badge in the list, and extend `checkConflicts` to compare one-off rows by date (and against recurring rows on the same weekday).
- No changes needed in `src/lib/spaAvailability.ts`; it already prefers `specific_date` matches.
