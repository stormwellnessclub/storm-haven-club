## Goal

Downgrade Dalal Elali's (`STM-000166`) Stripe subscription to **Silver Women's Monthly** so her **July 16, 2026** charge and every renewal after bills at **$200 dues + processing fee** — no proration, no immediate charge. The DB record already shows a pending Silver change from June; we just need to make Stripe agree and finalize the record.

## Current State

- Member row: `membership_type = Gold`, `pending_tier_change = Silver` (set 2026-06-17), `tier_change_used = false`.
- Stripe sub `sub_1TCPqOLyZrsSqLhsBwJDgcf7` (status `active`):
  - Item `si_UAlNN6QvtYMdrd` → Gold price `price_1Sl9pvLyZrsSqLhsIWyf2WwX` ($250)
  - Item `si_UAlNitKW7BmVK2` → Gold processing fee `price_1T4kPMLyZrsSqLhs9UZEUCg1` ($7.78, `base_amount=25000`)
  - Current period: 2026-06-16 → **2026-07-16** (next invoice date).

## Steps

1. **Create a Silver processing-fee price** on `prod_U28bascR7hn8we` (recurring monthly, `unit_amount = 628`, metadata `{ type: "processing_fee", base_amount: "20000" }`). Grossed-up per project formula: `(200 + 0.30)/(1 − 0.029) = $206.28` → fee = **$6.28**.
2. **Update the subscription** with `proration_behavior = "none"` and `billing_cycle_anchor = "unchanged"`:
   - Swap dues item to `price_1Sl9llLyZrsSqLhsJhm0MdJi` (Silver Women's Monthly, $200).
   - Swap processing-fee item to the new $6.28 price from step 1.
   - Add metadata `downgrade_effective = "2026-07-16"`, `previous_tier = "Gold"`.
3. **Verify** with `stripe_api_read` that the upcoming invoice for `cus_U6fdFuYWGsORnw` totals $206.28 on 2026-07-16 with no proration lines.
4. **Update the members row** for Dalal:
   - `membership_type = 'Silver'`
   - Clear `pending_tier_change`, `pending_tier_change_at`, `pending_tier_change_by`
   - Set `tier_change_used = true`, `tier_change_used_at = now()`
   - `updated_at = now()`
5. **Log** an `admin_action_log` entry: `action_type = 'tier_downgrade'`, notes referencing the June 9 request honored on the July 16 cycle.

## Out of Scope

- No refund/credit for the June 16 Gold charge (member already accepted).
- No changes to annual fee subscription `sub_1TBmP2LyZrsSqLhsYri0XEjH`.
- No proration line items.

## Verification

After running, I'll:
- Re-fetch the subscription and confirm both items point to the Silver prices.
- Pull the upcoming invoice preview and paste the exact $ total ($206.28) and next billing date (2026-07-16) back to you before we consider it done.
