# One-off Saturday opening for Arleacia — Sat Sep 5, 2:00 PM

Arleacia Parker currently has only one availability date on file: Sunday Sep 13, 10:00–19:00 in Spa Room 3, covering her six massage services. There is nothing on Sat Sep 5, which is why she can't be booked. The only appointment that day is Teresa in Spa Room 5 at 2:00 PM, so Spa Room 3 is free.

## What will be added

A one-off (specific-date) availability window:

- Date: Saturday, September 5, 2026
- Time: 2:00 PM – 4:00 PM
- Therapist: Arleacia Parker
- Room: Spa Room 3
- Services covered (all six she is assigned): Storm Signature Massage 60 / 90, Deep Relief Massage 60 / 90, Sports Performance Massage 60 / 90

The 4:00 PM end lets either a 60-minute or a 90-minute massage start at 2:00 PM and still finish inside the window with cleanup time. Nothing recurring changes — this affects only Sep 5.

After this, the 2:00 PM slot appears in the admin spa booking screen and you can book the client on her normally.

## Technical notes

Insert six rows into `spa_service_availability` with `specific_date = '2026-09-05'`, `start_time 14:00`, `end_time 16:00`, `therapist_id` Arleacia, `room_id` Spa Room 3, `max_bookings 1`, `is_active true` — one per service ID, matching the shape of her existing Sep 13 rows.

## Open question

If you'd rather the window be tighter (exactly one 60-minute slot) or wider (e.g. 2:00–6:00 so you can add more that afternoon), say so and it will be adjusted.
