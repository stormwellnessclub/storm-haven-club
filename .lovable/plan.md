# Charge Tyler for the rest of his 3-hour massage

## What's on file today (Fri Oct 2)

- **Client:** Tyler Lacy (tylerlacy99@gmail.com). This is not Tyler Bonkowski.
- **Booked:** Deep Relief Massage, 90 min, 3:30 PM, marked completed.
- **Already charged on his card: $305.** That covers the massage at $195, CBD at $20, Cupping at $20, 30 extra minutes at $60, and a $10 tip.
- **His record shows 120 minutes,** which is 90 booked plus the 30 extra.

## What's still owed

A 3-hour massage is 180 minutes, so 60 minutes haven't been charged yet.

```text
60 extra min x $2.00/min = $120.00
```

## What I'll do once you approve

1. Charge **$120.00** one time to the card Tyler already has on file, described as "Extended time, 60 additional min (3-hour massage)". It uses the $2 per minute rate, with no tip and no card fee added, the same way the first 30 minutes were charged.
2. Change his appointment to **180 minutes**. The extended time will read "Extended time (90 min), $180", so the 3 hours show correctly in his history, Teresa's/the therapist's payroll and reports.
3. Email Tyler a receipt for the $120 **only if you say so**. Otherwise no email goes out.
4. Read the record back to check it, and confirm in Stripe that the payment went through.

If his card is declined, nothing on his record changes and I'll tell you.

## Please confirm

- The amount: is $120 right (60 min at $2/min), or do you want a different amount or a tip added?
- Should Tyler get a receipt email?

## Technical details

- Appointment `79c66ca9-d270-4616-b743-bb162f840691`, Stripe customer `cus_UeFYRlxadzb79U`, first payment `pi_3UMEptLyZrsSqLhs0zV4QD2m`.
- The charge is an off-session PaymentIntent on his default saved card, using the existing admin charge path. It's tagged with the appointment id in metadata.
- Update: `duration_minutes = 180`. The `extended-time` addon becomes `{minutes: 90, price: 180, rate: 2}`, `addons_total` goes from 100 to 220, and `amount_paid` goes from 305 to 425. The new payment intent id is noted in `staff_notes`.
