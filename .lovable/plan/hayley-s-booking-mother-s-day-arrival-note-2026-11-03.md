# Hayley's booking + Mother's Day arrival note

## 1. Book Hayley Stempien
- Thursday, November 5, 10:00–11:00 AM, Storm Signature Massage (60 min) with Teresa Tyler (time is open on the schedule).
- Covered by her active Mother's Day voucher MOM-ABD3T5, linked to her account. No charge.
- Mark the voucher used, then send her the confirmation email with the intake form link, plus a text only if she has opted in to texts.

## 2. Staff note for every Mother's Day voucher appointment
Any spa appointment paid with a Mother's Day voucher shows a highlighted gold note wherever staff see the appointment (the spa schedule card, the appointment details, check-in and checkout):

```text
MOTHER'S DAY GUEST - includes wet spa access
Give her a short wet spa tour: wet spa, locker room, Wi-Fi password.
A full gym tour isn't needed unless she asks.
Best after her massage. If she arrives early and wants the wet spa first, that's fine.
```

- Shows up on its own for current and future voucher bookings. No one has to type it.
- Only staff can see it. Guests never see it.

## Technical details
- Add one shared `MothersDayArrivalNote` component plus a helper `isMothersDayVoucher(appt)` that checks `payment_method = 'mothers_day_voucher'`. Render it in the spa appointment card/detail, the check-in action, and `SpaCompletionDialog`.
- Add a small test for the helper.
- Booking goes through the same admin booking path used for Paulajean (voucher redeemed in the same transaction). The email is sent through the existing spa confirmation function.
