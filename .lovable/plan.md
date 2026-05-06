## Problem

Members get **"nothing available for the next 60 days"** when trying to book Red Light Therapy or Ice Bed (Dry Cryo) from the Wellness page, and Club Concierge requests for these services aren't going through either.

## Root Causes Found

1. **Member Wellness page sends fake service IDs.** `src/pages/member/Wellness.tsx` hands the booking modal hardcoded IDs `wellness-red-light` and `wellness-dry-cryo`. The modal looks up availability rows in `spa_service_availability` by `service_id`, finds zero matches, and shows the "60 day" message.

2. **No availability windows configured.** Even the real Red Light services in the DB (`Full-Body Red Light Therapy — 10` and `— 20`) currently have **0 rows** in `spa_service_availability`, so they would also appear empty.

3. **No "Ice Bed / Dry Cryotherapy" service exists** in `spa_services`. Members have `dry_cryo` credits but there is no service row to book against.

4. **Concierge tab UX gap.** The form only accepts a time today and forces ≥20 min from "now". If a member opens it late at night or wants tomorrow, validation silently blocks them and they think it's broken.

## Plan

### 1. Create the missing Ice Bed (ZeroBody Cryo) service
Insert into `spa_services`:
- Name: `Ice Bed (Starpool ZeroBody Cryo)`
- Category: `Recovery`
- Duration: 20 min, Cleanup: 10 min
- Price: $45 walk-in (adjustable)
- `is_active: true`

### 2. Seed availability windows for Red Light & Ice Bed
For all three services (`Full-Body Red Light Therapy — 10`, `— 20`, and the new Ice Bed), insert rows into `spa_service_availability`:

```text
Mon–Thu:  7:00 AM – 10:30 PM
Fri:      8:00 AM – 7:30 PM
Sat–Sun:  8:00 AM – 6:30 PM
```

All time pickers and labels in the booking UI will display in **12-hour format with AM/PM** (e.g. "7:00 AM"), not 24-hour. The DB still stores `HH:mm` internally — display only.

Assign `room_id` to the existing **Red Light Therapy** room for Red Light. Ice Bed reuses `Spa Room 5` unless you want a dedicated room. No therapist required (self-service recovery).

### 3. Fix the Member Wellness page to use real services
In `src/pages/member/Wellness.tsx`:
- Remove the hardcoded `WELLNESS_SERVICES` constant. Query the real `spa_services` rows for Red Light (20 min) and Ice Bed by name/category.
- Pass the real DB UUID into `SpaBookingModal`, so availability lookups, `findCoveringSlot`, and the `book_wellness_appointment` RPC all work.
- Keep tile UI (orange Zap = Red Light, blue Snowflake = Ice Bed) and ensure all displayed times use 12-hour AM/PM.

### 4. Make Club Concierge requests reliable
In `src/components/member/ClubConciergeTab.tsx`:
- Add an explicit **date picker** (today or future) next to the time picker. Today still requires ≥20 min from now; future dates accept any time within club hours.
- Time picker shows 12-hour AM/PM format.
- Replace silent failures with clear errors ("Please pick a time during club hours: 7:00 AM – 10:30 PM Mon–Thu, …").
- Show the member's current credit balance directly on the Ice Bed and Red Light cards so they know it uses a credit (no charge).

### 5. QA after changes
- Member with Gold/Platinum/Diamond credits opens **Wellness** → both tiles show real time slots in 12-hour format for the next 7 days.
- Booking with a credit deducts via `book_wellness_appointment` and creates a row in `spa_appointments`.
- Concierge tab: submit a Red Light request for tomorrow at 9:00 AM → conversation appears in admin Email/Support inbox under category `concierge`.

## Technical Notes

- Files touched (code): `src/pages/member/Wellness.tsx`, `src/components/member/ClubConciergeTab.tsx`. No changes to `SpaBookingModal` itself — it already works correctly when given a real `service_id`. Will use existing `formatTime12h` helper from `src/lib/timeFormat.ts` everywhere times are displayed.
- DB changes (data only, no schema): one `INSERT` into `spa_services` (Ice Bed) and ~21 `INSERT`s into `spa_service_availability` (3 services × 7 days). Stored as `HH:mm` per existing schema; display layer converts to 12-hour AM/PM.
- Booking RPC `book_wellness_appointment` already enforces credit type matching, so existing `dry_cryo` and `red_light` credits will be consumed correctly once the right `service_id` flows through.

## Open question (non-blocking)
Should Ice Bed reuse `Spa Room 5`, or should I create a dedicated **"ZeroBody / Ice Bed"** room so the admin Day View shows it on its own row? Default if no answer: reuse `Spa Room 5`.
