## How the gift email currently works

When a buyer marks the purchase as a gift on `/mothers-day`:

1. `mothers-day-create-intent` stores `recipient_name`, `recipient_email`, `gift_message`, etc. on the voucher row.
2. After Stripe confirms payment, `mothers-day-confirm` flips the voucher to `active` and invokes `send-mothers-day-voucher`.
3. `send-mothers-day-voucher` builds the gold/cream HTML (with "To: {recipient} / From: {buyer}" + gift message + voucher code) and sends it to **both** the recipient and the buyer (BCC-style — array of two `to` addresses) via Resend.

The recipient line / gift message only appears on the email when `recipient_name` is set — i.e. the gift checkbox was used at checkout.

## What to add

### 1. Admin: Resend voucher email
On each voucher row in `MothersDayTab.tsx`, add a "Resend email" button (icon button) next to "Mark Redeemed". It calls `send-mothers-day-voucher` with the voucher id. Toast on success / error. Works for any status that has the voucher already created (active, redeemed) — useful when the recipient says they never got it or the gift message needs resending.

### 2. Admin: Sell Mother's Day in-house
Add a "Sell Mother's Day Special" button at the top of the Mother's Day tab that opens a dialog. The dialog mirrors the public `/mothers-day` form (buyer name/email/phone/gender, massage choice + duration, gift toggle + recipient details, gift message), plus a payment method selector:

- **Card on file / Charge card now** — uses existing front-desk POS pattern (calls a new edge function `mothers-day-admin-sell` that creates the voucher + charges the saved payment method or a fresh one off-session via Stripe terminal/PaymentIntent confirm). Reuses the same gross-up fee logic.
- **Cash / external** — creates the voucher row directly with `status: 'active'`, records `payment_method: 'cash' | 'check' | 'external'`, no Stripe charge. Captures `sold_by_admin_id` and a notes field.
- **Send invoice link** — generates a Stripe-hosted PaymentIntent and emails the buyer a link (skip if not needed; we can just default to the two methods above).

After the voucher is created, the same `send-mothers-day-voucher` is invoked so the recipient (or buyer) gets the branded email automatically.

### 3. Track in-house sales
Add columns to `mothers_day_vouchers`:
- `sold_in_house boolean default false`
- `sold_by_admin_id uuid` (references auth user)
- `payment_method text` — values: `online`, `card_on_file`, `card_in_person`, `cash`, `check`
- `admin_notes text`

CSV export gets a "Sale Source" column (Online vs In-house) and "Payment Method".

### 4. Edge function: `mothers-day-admin-sell`
- Verifies caller has admin/front-desk role (`has_any_role`).
- Validates the same fields as `mothers-day-create-intent`.
- For cash/check: insert voucher with `status: 'active'`, no Stripe call.
- For card-in-person/card-on-file: create PaymentIntent (gross-up fee), confirm against the chosen payment method, then mark voucher active on success.
- Always invoke `send-mothers-day-voucher` after creation.
- Return voucher details + code.

## Files

- `supabase/migrations/...` — add 4 columns to `mothers_day_vouchers`.
- `supabase/functions/mothers-day-admin-sell/index.ts` — new edge function.
- `src/components/admin/spa/MothersDayTab.tsx` — add "Sell" button + dialog, "Resend email" button per row, "Sale Source" filter and CSV columns.
- `src/components/admin/spa/MothersDaySellDialog.tsx` — new dialog component (form + payment method picker).
- Memory: update `mem://features/promotions/mothers-day-special` to note in-house sales + resend capability.

## Notes

- `send-mothers-day-voucher` already does the heavy lifting; we only call it from one new place (admin resend) and re-call it for in-house sales.
- Gift email currently goes to **both** recipient and buyer — we keep that behavior for in-house sales too.
- Processing fee gross-up only applies when actually charging a card; cash sales are recorded at base price (`processing_fee_cents = 0`, `amount_paid_cents = base_amount_cents`).
