# Apply the GitHub payment-records update

## What I found
The GitHub push included one database change, "payment ledger integrity." It is **not live yet**. Your database doesn't have it, so the code that relies on it may not work correctly until it is applied.

What the change does:
1. **Deleting a member keeps their payment history.** Their past payments, revenue and sales-tax totals stay the same. Only the link to the deleted member is removed.
2. **A membership payment is applied to money owed only once,** even when two parts of the system see the same payment.
3. **Each card payment is saved only once.** This is turned on only if no duplicates exist today. If some do, it lists how many need review and changes nothing else.

## What I'll do
- Apply this database change exactly as it was pushed.
- Confirm afterward that all three parts took effect, and report any duplicate payments it found.
- No charges, emails or member changes.

Screen changes from that push still need **Publish, then Update** to reach the live site.

## Technical details
- Run `supabase/migrations/20261009120000_payment_ledger_integrity.sql` as a migration. Today the newest applied migration is 20260828084325, and `manual_charges.arrears_settled_at` is missing.
- Verify: the member_id foreign keys on `payment_attempts` and `manual_charges` are ON DELETE SET NULL, the `arrears_settled_at` column exists, and check the unique index on `stripe_payment_intent_id` (or the duplicate warning).
