## Problem

When you update Kids Care hours in the admin editor, the public **/kids-care** page keeps showing the old hours. Members can then book against stale times.

**Root cause:** The admin editor writes to the new `kids_care_hour_slots` table, but the public Kids Care page is still reading from the deprecated `kids_care_hours` table via `useKidsCareHoursForWeek`. They're two completely different data sources, so admin edits never reach that page.

The other member surfaces are already correct:
- **Booking modal** (`KidsCareBookingModal`) — uses `useKidsCareHoursForDate` (new table) with realtime + 30s polling + window-focus refetch.
- **Member upcoming list** (`/member/kids-care/bookings`) — uses `useUpcomingKidsCareSlots` (new table) with the same freshness setup.

So only the public **Hours of Operation** card on `/kids-care` is broken.

## Plan

Switch the public Kids Care page to read from the new slot-based hook so it reflects what was saved in the editor and stays fresh automatically.

1. In `src/pages/KidsCare.tsx`:
   - Replace `useKidsCareHoursForWeek(new Date())` with `useUpcomingKidsCareSlots(7)` (already includes realtime subscription + 30s refetch + refetch on window focus, defined in `useKidsCareHours.ts`).
   - Rewrite the "Hours of Operation" card (lines ~240–274) to group the returned slots by `slot_date` and render each day with its slot times. Days with no published slots simply don't appear; if no slots exist in the next 7 days, show the existing "haven't been published yet" message.
   - Use `date-fns` `format` (already used elsewhere) to render the day name from `slot_date`, and the existing `formatTime12h` helper for `open_time`/`close_time`.
   - Remove the now-unused `useKidsCareHoursForWeek` import and the `DAY_NAMES` array if no longer referenced.

2. No changes to the booking modal or member bookings page — they're already on the correct hook and refresh automatically.

3. No database, admin, or hook changes needed. The `useKidsCareHours.ts` hooks already invalidate cache on realtime events from `kids_care_hour_slots`, so once the public page uses the right hook, your Saturday/Sunday edits show up within seconds (and immediately on tab focus).

## Out of scope

- Deleting the legacy `kids_care_hours` table or `useKidsCareHoursForWeek` hook (kept for safety; can be removed later in a cleanup pass).
- Any change to admin write paths or booking validation.
