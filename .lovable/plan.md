# Open online booking for the 90-minute Seaweed Body Wrap Ritual

## What's wrong
Clients can already book the 70-minute ritual ($220) online. The 90-minute option ($290) appears in the booking window but has no open times. Nothing was set up for it, so nobody can book it.

## Fix
- Give the 90-minute option the same hours as the 70-minute one: Teresa, Spa Room 6, Monday–Saturday, 10 AM–8 PM.
- Both lengths use the same therapist and room, so the existing double-booking check still keeps them from overlapping.
- Prices stay the same: $220 for 70 minutes, $290 for 90 minutes. The waiver and card on file are still asked for after the client picks a time.
- Nothing changes for other body wraps. They stay request-only.

## Check
- Open the ritual on the Spa page, pick 70 and then 90, and confirm each shows open times for the next few weeks with the correct price and length.
- No test booking or charge will be made.

## Note
I chose these hours (Teresa, Mon–Sat, 10–8, Room 6) for the 70-minute option earlier myself. Tell me if the real days, hours or therapist are different and I'll set both options to match.

## Technical details
- Insert six weekly `spa_service_availability` rows for service `733d1344-...` (Extended) copying therapist_id, room_id, days 1–6 and 10:00–20:00 from the 70-min rows. Use a data insert guarded by NOT EXISTS, not a schema change.
