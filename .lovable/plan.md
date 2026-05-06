## Goal
Charge the buyer the Stripe processing fee on top of the massage price (same gross-up formula used elsewhere: `(amount + $0.30) / (1 - 0.029)`), so the club nets the full massage price.

## Changes

### 1. Edge function `mothers-day-create-intent`
- Treat incoming `amount_cents` as the **base** (massage price).
- Compute `processing_fee_cents` server-side via the same formula in `src/lib/processingFee.ts` (ceil((base+30)/0.971) − base). Never trust a client-supplied total.
- Charge Stripe the **total** (`base + fee`).
- Store on the voucher row:
  - `amount_paid_cents` = total charged (so admin Revenue/CSV reflects what the customer actually paid)
  - extend metadata: `base_amount_cents`, `processing_fee_cents` on the PaymentIntent for reconciliation
- Add `base_amount_cents` and `processing_fee_cents` columns on `mothers_day_vouchers` so we can report net vs. fee. Default 0; backfill existing rows where `amount_paid_cents` already equals base by setting `base_amount_cents = amount_paid_cents`, `processing_fee_cents = 0`.

### 2. Frontend `src/pages/MothersDay.tsx`
- Use `calculateProcessingFee` from `src/lib/processingFee.ts` to compute fee from selected massage price.
- In the form step, under the massage list show a small breakdown:
  - Massage: $X
  - Processing fee: $Y
  - **Total: $Z**
- Pay button text and confirmation header use the **total** (base + fee).
- Send only `amount_cents` = base to the edge function (server recomputes fee). PayForm `amountCents` prop becomes the total returned by the intent (already equal to charge amount).
- Pass total back from edge function response (`total_cents`) to display on the payment step header.

### 3. Admin tab `MothersDayTab.tsx`
- KPI "Revenue" continues to use `amount_paid_cents` (= total charged).
- Add a small "Net (after fees)" sub-line under Revenue using `sum(base_amount_cents)` when present, falling back to `amount_paid_cents`.
- CSV: add columns `Base`, `Processing Fee`, keep existing `Amount` (now total).

### 4. Memory
- Update `mem://features/promotions/mothers-day-special` to note the buyer pays the processing fee on top of the massage price.

## Technical notes
- Migration adds two integer columns; idempotent for rows already created (defaults to 0).
- `mothers-day-confirm` doesn't need changes — it already keys off `payment_intent_id` and the voucher row already carries the total.
- Email template (`send-mothers-day-voucher`) doesn't show price, so unaffected.
