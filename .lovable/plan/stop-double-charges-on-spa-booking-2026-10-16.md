# Stop double charges on spa booking

## What happened (verified)
- **Fatima Jomaa, today 5:21 PM:** three charges of $201.14 for one Deep Relief Massage (90 min, Sat Oct 17, 2 PM). All three went through. She has one appointment and was overcharged $402.28.
- **Oct 15, Storm Signature Massage (60 min):** the same thing happened, three charges in 3 seconds. Only one went through and the other two were declined, so that client was charged once.

## Why it happens
When someone taps "Book", the app charges the card first and creates the booking after. The button only locks and shows a spinner once the booking step starts. The card charge itself takes a few seconds, and during that time nothing shows the tap worked, so the button still looks clickable. Every extra tap starts a new charge, and nothing on the payment side rejects a repeat. That pause is the "lag" people see.

## Fix
1. **Lock the button from the very first tap.** It shows "Processing payment…" with a spinner right away and can't be tapped again until the booking finishes or fails.
2. **Duplicate protection on the payment side.** Each booking attempt gets one unique code. If the same attempt reaches the card processor twice, Stripe returns the first charge and doesn't take money again. A tap that sneaks through can never charge twice.
3. **If the card is charged but the booking fails** (for example, someone takes the slot in the same second), the charge is refunded automatically and the client sees a clear message.
4. **Refund Fatima's two extra charges ($201.14 × 2 = $402.28)** back to her card and keep the one that covers her appointment. Only after you approve this plan.

## Technical details
- `SpaBookingModal.tsx`: add an `isProcessing` state, set it synchronously at the top of `handleBook` (plus a ref guard against same-frame double taps), and use it for `disabled` and the spinner label.
- Generate `attemptKey = crypto.randomUUID()` once per confirm and send it as `idempotencyKey` to `charge_saved_card`.
- `stripe-payment` `charge_saved_card`: accept an optional `idempotencyKey` and pass it to `paymentIntents.create` (same pattern `admin_charge_user_saved_card` already uses). Redeploy.
- On a booking failure after a successful charge, call the existing refund action for that payment intent.
- Refund Fatima's two extra payment intents, `pi_3URIZULyZrsSqLhs0R2De73F` and `pi_3URIZWLyZrsSqLhs08WA1nqo`, and mark them refunded in the charge records. Keep `pi_3URIZSLyZrsSqLhs1rajjtku`.
- Check the other saved-card screens (shop, café, front desk register) for the same missing lock and add it where it's missing.
