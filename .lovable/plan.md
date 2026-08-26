# Send Confirmation Emails for the Sept 13 Massages

## The 4 appointments (all Sunday, Sept 13, 2026)

| Time | Guest | Email | Service | Therapist | Intake done? |
|---|---|---|---|---|---|
| 10:00 AM | Jessica Keep | keepjessica1@gmail.com | Prenatal Massage — 90 min | Teresa Tyler | No |
| 10:00 AM | Caroline Landry | ckeep@umich.edu | Storm Signature Massage — 90 min | Arleacia Parker | No |
| 11:50 AM | Suzanne Keep | suzkeep@gmail.com | Storm Signature Massage — 90 min | Arleacia Parker | No |
| 11:50 AM | Sarah Cottrell | sarahkcottrell@gmail.com | Deep Relief Massage — 90 min | Teresa Tyler | No |

All four are non-members with accounts, so their intake links will point to the guest portal.

## The email they will get

Subject: **Spa appointment confirmed — Storm Signature Massage — 90**

Body (Storm header/logo at top, standard footer at bottom):

```text
Appointment Confirmed ✓

Looking forward to seeing you. Here are the details:

  Service    Storm Signature Massage — 90
  Date       Sunday, September 13, 2026
  Time       11:50 AM
  With       Arleacia Parker
  Duration   90 min

[ Arrival — gold box ]
Please arrive 10 minutes early to settle in.
Cancellations within 24 hours may incur a fee.

[ Before your session — intake form — green box ]
Please complete your intake form so your therapist can tailor the
session (focus areas, pressure, health notes). It only takes a
couple of minutes.
            [ Complete Intake Form ]   <- links straight to their form

            [ View My Appointments ]

— The Storm Wellness Club Team
```

Each guest's own service, time, and therapist are substituted in. The two buttons go to
`stormwellnessclub.com/portal/bookings?intake=<their appointment>` and
`stormwellnessclub.com/portal/bookings`.

## What I'll do once you approve

1. Send that confirmation to all four addresses, one call per guest, with their own details.
2. Also fire the matching confirmation text to anyone with SMS opted in (same path the app uses).
3. Report back per guest: sent / failed, so you know exactly who got it.

Nothing changes in the app itself — these were booked before the new staff-booking confirmation
checkbox went live, so this is a one-time catch-up send. Their automatic 24-hour reminder (which
also nudges the intake form) will still go out on its own.

## Technical detail

Invoke the deployed `send-email` function four times with
`type: 'spa_appointment_confirmation'` and data `{ service, date, time, provider, duration,
bookingsPath: '/portal/bookings', needsIntake: true, intakeUrlPath: '/portal/bookings?intake=<id>' }`.
No database or code changes.
