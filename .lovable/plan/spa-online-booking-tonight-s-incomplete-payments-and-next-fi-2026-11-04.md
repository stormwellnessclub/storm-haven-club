# Spa online booking: tonight's incomplete payments and next fixes

## What tonight's two "Incomplete" payments actually were

Both were for the 60-minute Storm Signature Massage, Wed Nov 4 at 3:30 PM, $159.94.

1. **Zahra Al-zayadi** (zahraalzayadi@yahoo.com, 248-862-0300), 9:45 PM
   - The "Unable to start payment" error did **not** happen. Her booking opened the card screen fine.
   - No card was ever entered or submitted, so there was no decline. She left at the card screen.
   - She is not booked, and that 3:30 PM time is still open.
2. **"Tsst" / tast@gmail.com** (313-286-5070), 10:56 PM
   - The name and email look like a test. A real Visa ending 2863 was entered and **declined for insufficient funds**.
   - The guest saw Stripe's message on screen: "Your card has insufficient funds. Use a different payment method."

The fix from earlier today is on the live site (I checked the live code). Nobody has been turned away by a server refusal since then.

## Why Stripe still shows so many "Incomplete" payments

Stripe opens a payment as soon as someone reaches the card screen. If they leave, or their card is declined and they don't try again, it stays "Incomplete" for good. Our booking hold ends after 20 minutes, but the Stripe payment is never closed, so it piles up as "Incomplete." That makes it look like more failures than there really are.

## Proposed changes

1. **Close abandoned payments.** When a 20-minute booking hold ends unpaid, cancel its Stripe payment, so Stripe shows "Canceled" instead of "Incomplete." No charge is made either way.
2. **Show the reason on staff's "Unfinished online bookings" list.** Each person gets a clear label: "Left at card screen", "Card declined: insufficient funds" (or another bank reason), or "Turned down: <reason>." Staff will know who to call and what to say.
3. **Apple Pay and Google Pay** on the card screen. Phone guests can pay with one tap instead of typing a card, which is where most people stop.
4. **Follow up with Zahra.** With your OK, call her at 248-862-0300. She hasn't agreed to texts, so a text isn't allowed. Or I can send her one polite email with a fresh booking link. I won't send anything until you choose.

## Technical details

- Cancelling payments: on the next `spa-guest-checkout` call, plus a self-removing one-time timer armed when a hold is created (no polling). For `pending` rows past `expires_at`, it calls `paymentIntents.cancel` / `setupIntents.cancel` with idempotency keys, but only when the status is `requires_payment_method` or `requires_confirmation`. It never touches `requires_capture` or `succeeded`. The row is marked `expired`.
- Decline reasons: the `UnfinishedOnlineBookings` component reads `last_payment_error.decline_code` and `message` through a staff-only function action, using the stored `payment_intent_id`.
- Wallets: switch the PaymentIntent/SetupIntent to `automatic_payment_methods` (cards plus wallets, no redirect methods). Register `stormwellnessclub.com` and `www` as Apple Pay payment method domains in Stripe. Manual capture and `setup_future_usage` stay the same.
- Tests: expiry only cancels unpaid intents, and decline-reason mapping. No live cards are charged, and no real clients are contacted during testing.
