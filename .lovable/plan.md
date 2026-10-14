# Fix Victoria Fletcher's payments, and stop paid dues from getting charged again

## What actually happened (checked in Stripe)

Victoria's card shows two successful $250 charges, and they paid for the same month:

```text
Oct 7   $250  SUCCEEDED  "Sept past due"  <- you charged this in Stripe by hand
Oct 13  $250  SUCCEEDED  Stripe's own retry of the September dues bill
Oct 9+  $250  FAILED x3  October dues bill (Oct 9 - Nov 9), still open
```

- The $250 you charged on Oct 7 was a separate charge. It was **never applied to her September bill**, so Stripe kept retrying that bill and collected it a second time on Oct 13.
- Result: she has paid $500, which covers September and October, but Stripe still shows October as open. So she is still flagged past due, and Stripe will keep retrying her card for another $250.
- The app also labels each bill by the start of the month *before* the one it covers, which is why the September and October bills looked swapped.

This will happen to anyone you charge by hand in Stripe while their bill is still open.

## The fix

### 1. Correct Victoria now
- Mark her October bill **paid outside Stripe**, using the Oct 7 charge. Stripe then stops retrying, so she won't be charged a third time.
- Note it on her record ("Oct 7 manual charge applied to Oct 9 dues"), then clear past due through the normal billing status change so she can check in.
- No refund, because the $500 she paid matches two months owed.

### 2. Find everyone else this happened to
Check every member's Stripe history for a successful hand-made charge followed by Stripe also collecting the bill it was meant for. You get a list showing the person, both charges, and whether there's still an open bill it could pay off or it was a true double charge that needs a refund. Nothing gets changed without your approval.

### 3. Stop it happening again
- **Nightly check:** the nightly billing check will catch any successful hand-made dues charge (made in Stripe or in the club) that hasn't been tied to a bill while that member still has an open one. It applies the charge to that bill so Stripe stops retrying, and it notes this on the record. That lifts a restriction, so the rule allows it to happen automatically. Anything unclear goes to staff review.
- **Charges made in the club:** collecting dues from the member page pays the open Stripe bill directly instead of making a separate charge, so a double charge can't happen.
- **Correct labels:** bills are labelled by the dates they actually cover (Oct 9 – Nov 9), not one month earlier.

## Technical notes
- Victoria: `stripe.invoices.pay(in_1UOXaf…, { paid_out_of_band: true })` with metadata linking `ch_3UNpIl…`; update `billing_arrears` row; status via `apply_billing_status_change`.
- Audit: for each customer, standalone succeeded charges (no `invoice`, description matching dues/past due), matched against invoices paid after them for the same amount.
- `reconcile-billing`: new release-only correction "orphan manual charge → oldest open dues invoice paid_out_of_band"; unmatched amounts go to staff review.
- In-club dues collection: switch the dues path to `invoices.pay` with the selected payment method (fee line rule still applies).
- `billing_arrears.period_start/end` come from the invoice line `period`, not the invoice header `period_start/end`; backfill existing rows.
