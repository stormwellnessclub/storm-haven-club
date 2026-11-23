# Cancel Joseph Puranen's Wednesday massage and refund him

**Appointment found:** Joseph E Puranen (joe.puranen@gmail.com, 734-658-2490). Deep Relief Massage, 60 minutes, Wednesday Nov 25 at 10:00 AM. He paid by card on Nov 16. Stripe shows **$159.94 charged**: the $155 massage plus the payment processing fee.

## What I'll do
1. Refund the **full $159.94** to the card he paid with. Cards usually show the refund in 5–10 business days.
2. Mark the appointment **cancelled**, with the reason "Cancelled by club, refunded in full". This frees the 10:00 AM slot with his therapist.
3. Send him the usual club cancellation **email and text**. The text goes only if he agreed to texts. Both say the appointment is cancelled and a full refund is on its way.
4. Check that Stripe shows the refund and that the appointment shows as cancelled, then report back.

No late-cancel fee, because the club is cancelling. Nothing else changes on his account.

**Before I start, tell me:**
- If you want a partial refund instead (for example, $155 without the processing fee), and how much.
- If you'd rather not send him the email and text.

## Technical details
- Appointment `e6f3eaac-4b4a-4f48-896e-62b531b743d7`, payment `pi_3UcRlJLyZrsSqLhs0ij32laE` (succeeded).
- Refund through Stripe with an idempotency key and metadata linking it to the appointment. Then update `spa_appointments` (status, cancelled_at, cancellation_reason). The refund appears in revenue_ledger at its next sync.
- Notifications use the existing spa cancellation email plus `send-sms`, with consent checked.
