# Fix: PT package sale charges the card but fails to create the pass

## What happened

The sale you just ran did charge the customer — Stripe payment `pi_3U868CLyZrsSqLhs1SpC79IF` for **$566.74** (a $550 semi-private 10-Pack plus the $16.74 processing fee) went through and is recorded as succeeded. What failed was the step right after: writing the PT pass into the system. No pass row exists for that customer, so they were billed and got nothing on their account.

Cause: the sell dialog sends a field named `adminNotes` when creating the pass, but the PT passes table stores that field as `notes`. The database rejects the unknown field, the whole sale errors out after the money has already moved.

## The fix

1. **Correct the field name** in the PT sale dialog so notes save to `notes`. This unblocks all future card-on-file, cash, and comp PT sales.
2. **Add a safety net** for the card-on-file path: if the pass write fails after a successful charge, show a clear, non-dismissible error naming the charge that already went through (amount + payment ID) instead of a generic "Failed to record sale", so front desk knows the customer was billed and can flag it.
3. **Recover the sale that just failed** — create the 10-session semi-private pass for the charged customer, linked to the existing Stripe payment, with today's activation and the standard expiry, so the money and the sessions line up.

## Technical notes

- `src/components/admin/SellPTDialog.tsx` → `insertPasses()` builds rows with `adminNotes:`; rename to `notes:`. Same check for `GrantLegacyPtPackDialog.tsx` and any other `pt_passes` insert path.
- The recovery pass: `user_id c5a91b9b-f441-42a6-8157-3393d100dfb2`, `pack_id abb5b65d-42cd-4825-88af-61d0bc8d144e`, `format semi_private`, `sessions_total/remaining 10`, `price_cents_charged 55000`, `payment_method card_on_file`, `stripe_payment_intent_id pi_3U868CLyZrsSqLhs1SpC79IF`, status active — inserted via a data change, expiry matching the pack's standard window.
- No edge function change needed; `stripe-payment` behaved correctly.
