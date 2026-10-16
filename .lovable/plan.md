# Clear "Prepaid" status on spa appointments

## What's wrong
The checkout window shows the same yellow "Previously recorded" box for any appointment that has an amount saved. It doesn't say whether the client actually paid online. Jamila, Nancy and Fatima (Sat Oct 17) all paid online by card ($142.60, $215.00, $195.00), but nothing on screen makes that obvious.

## What staff will see
- **Appointment lists and the appointment screen** (admin and front desk) get a status badge:
  - Green **"Prepaid · $X · card ••1234"** when the client paid online at booking
  - Blue **"Paid at desk · $X"** when staff took the payment
  - Gray **"Not paid"** when no money was taken. Having a card on file still shows "Not paid" until a charge goes through.
- **Checkout window:** the yellow box is replaced:
  - Prepaid appointments show a green "Already paid online — $X on [date]" box. The full price is credited, so the balance due starts at **$0.00**.
  - Staff can still add add-ons, a tip or a price change. The window charges or records **only the difference** (for example, "Add-ons $25 + tip $30 = $55 due"). The original online payment is never charged again or overwritten.
  - If the price goes down below what was paid, the window shows "Overpaid by $X". It does not refund anything automatically.
- The success message and charge history show both lines: the original prepayment and the added charge.

## Technical details
- Prepaid = `payment_intent_id` present and `amount_paid > 0` (set by online booking). Desk-paid = `amount_paid > 0` without an online intent, or `payment_method` in cash/check/other.
- Shared helper `getSpaPaymentState(appt)` used by the badge in `SpaAppointmentEditModal`, the day/list rows, and `SpaCompletionDialog`.
- `SpaCompletionDialog`: balance due = new total − prepaid amount. Charge the saved card (with an idempotency key) or record cash for the balance only. Save `amount_paid = prepaid + extra` and `tip_amount`, and keep the original `payment_intent_id`. If the extra charge fails, the prepayment record is left untouched.
- No change to online booking or Stripe settings. No test charges on real clients.
