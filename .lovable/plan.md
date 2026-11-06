# Spa online booking: why tonight's payment failed, and follow-up

## What happened (checked against live records)
Only one real person tried to book online in the last 2 days: Keshona Murray, a 60-minute Deep Relief Massage for Fri Nov 6 at 7:00 PM.
- Attempt 1 (Thu ~2:47 PM): she got to the card screen and left without entering a card. Hold expired on its own.
- Attempt 2 (Thu ~9:31 PM): she entered a **prepaid Visa** (ending 5793). Stripe declined it as **suspected fraud**, so her card was never charged. No ZIP or security-code check could run on that card.
- No booking attempts were refused by our own system (zero refusals logged). The app is working; the bank/Stripe fraud screen stopped the card.

Earlier "failures" were a test with insufficient funds and Alieu's booking, which went through.

## Proposed changes
1. **Clearer message for this decline**: when a card is flagged this way, show "Your card couldn't be accepted. Please try a different debit or credit card, or call us to book," instead of a generic decline.
2. **Staff alert**: when a real guest's card is declined, send the spa desk an internal notice (name, phone, requested time) so someone can call them the same day. No text or email goes to the guest automatically.
3. **Unfinished bookings view**: label prepaid-card fraud declines plainly ("Card declined by bank fraud check — prepaid card").
4. Keshona's 7:00 PM Friday slot is still open; staff can call her at 734-469-6409 to book by phone.

## Technical details
- Map Stripe `decline_code: fraudulent` (and `card.funding: prepaid`) in `spa-guest-checkout` refusal/decline handling to a dedicated stop reason and client message.
- Internal staff notice via existing admin notification path; never contacts the client; respects the internal-test rule.
- No Radar rule changes (prepaid blocking is Stripe's risk decision; loosening it raises chargeback risk).
