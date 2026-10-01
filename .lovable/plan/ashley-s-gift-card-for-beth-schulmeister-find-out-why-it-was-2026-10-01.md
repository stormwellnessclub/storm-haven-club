# Ashley's gift card for Beth Schulmeister: find out why it wasn't sent, then send it

## What I found
- Gift card **STORM-US8Z-34TH**, $100. Bought online on Sept 29 at 10:31 PM Detroit time by **Ashley Schulmeister** (afowler07@gmail.com).
- Recipient: **Beth Schulmeister**, elizabeth.schulmeister@gmail.com.
- It was set to send **today, Oct 1 at 10:00 AM** Detroit time.
- **The email was not sent.** The card still shows as "pending", meaning the system never confirmed her payment. The scheduled send only picks up cards whose payment is confirmed, so it skipped this one. That's also why Ashley sees nothing in her account: her purchase history hides pending cards.

## Steps
1. **Check the payment in Stripe.** Look up this card's payment and confirm whether Ashley was actually charged.
2. **If she was charged:**
   - Activate the card and send Beth the gift card email now.
   - Send Ashley her receipt.
   - Mark the card as delivered so it shows as sent in Ashley's account and in Admin → Gift Cards.
3. **If she wasn't charged** (for example, the card was declined or she didn't finish checkout): don't send anything. I'll tell you, so the front desk can ask Ashley to buy it again or take payment in person.
4. **Find the cause.** Check why the payment confirmation never came through. If other gift cards are stuck the same way, list them for you to review. I won't send any of those without your OK.

## Technical notes
- Look up the Stripe payment `pi_3ULDIQLyZrsSqLhs0Q8JOQz6`. If its status is succeeded, call `confirm-gift-card-purchase` as a server caller. That sets the card active and sends the delivery email and the receipt.
- Check the Stripe webhook logs for `payment_intent.succeeded` on this payment. Then look for other `gift_cards` rows that are still pending with an online purchase more than an hour old.
