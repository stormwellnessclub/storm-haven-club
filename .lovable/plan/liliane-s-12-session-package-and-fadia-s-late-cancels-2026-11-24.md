# Liliane's 12-session package and Fadia's late cancels

## Liliane Idriss (active member)
1. Add a 12-session Semi-Private package priced at $660 (12 x $55), reason: "12 sessions at member single price; $320 cash + card on file."
2. Record $320 paid in cash.
3. Charge the remaining $340 to her saved card, plus the usual payment processing fee: $350.46 total. Stripe will label it "PT Semi-Private 12 Sessions (balance after $320 cash)". If she has no saved card or the card is declined, I stop and tell you, and the cash payment stays recorded.
4. Apply her 10 owed sessions to the package: 9 completed (Nov 2, 4, 6, 9, 11, 16, 18, 20, 23) plus the Nov 13 late cancel. Her $550 balance clears.
5. Hold one session for her Nov 25 booking. Result: 12 total, 10 used, 1 held, 1 free to book.

## Fadia Akil
All 3 of her cancellations were inside the 24-hour window.
1. Charge the Nov 4 late cancel (cancelled about 15 hours before) and take one session from her package.
2. Nov 13 is already charged. No change.
3. Leave Nov 16 free. It was booked only that same afternoon.
4. Result: 3 sessions left becomes 2 left.

## Not included
- No texts or emails sent.
- No other sessions or balances changed.

## Technical details
- Liliane: create the package through the admin PT sale path (custom price override, mixed tender: cash $320 + off-session card charge for the rest). Package-backed appointments become payment_status 'pass' by the existing trigger. Reserve one hold for the Nov 25 appointment.
- Fadia: set the Nov 4 appointment to late_cancel with package deduction on her remaining Single Session pass, recorded in pt_session_usage.
- Read both back afterward to confirm the balances.
