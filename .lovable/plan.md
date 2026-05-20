## Cafe Credit System for Members

A member-only credit wallet on top of the existing Cafe POS, supporting three grant types and a single unified redemption flow at checkout.

### Grant types (all admin-only)

1. **Cash balance** — Add $X to a member's wallet (gift, comp, manual top-up). Deducts dollar-for-dollar at checkout.
2. **Prepaid item** — Mark N units of a specific menu item as prepaid (e.g. 10 lattes). Deducts 1 unit per matching item at checkout, $0 to member.
3. **Charge card → credit** — Run their card-on-file now for $X, deposit $X to their cash wallet for future use. Same flow as #1, but funded by a Stripe charge instead of being free.
4. **(Implicit) Manual adjustments** — Refund / decrement with reason, stored in the same ledger.

### Data model

Two new tables, both members-only.

**`cafe_credit_ledger`** — append-only audit of every grant, charge-fund, redemption, adjustment.
- `member_id`, `kind` (`cash_grant` | `cash_purchase` | `item_grant` | `redemption_cash` | `redemption_item` | `adjustment`)
- `amount_cents` (signed, negative = debit), `item_quantity` (signed, for prepaid items)
- `menu_item_id` (nullable, for item grants/redemptions)
- `cafe_order_id` (nullable, links redemptions to the order)
- `stripe_payment_intent_id` (nullable, for `cash_purchase`)
- `reason` text, `created_by` uuid, `created_at`

**`cafe_prepaid_items`** — current remaining count per (member, menu_item).
- `member_id`, `menu_item_id`, `quantity_remaining`, unique on the pair.

**Derived balance:** sum of `amount_cents` from ledger per member, exposed via `get_member_cafe_credit_balance(member_id)` RPC. No expiration, no refunds (per your spec).

**RLS:** members can SELECT their own ledger + prepaid rows; staff (`cafe_staff`, `admin`, `manager`, `super_admin`) can do everything via SECURITY DEFINER RPCs.

### Atomic redemption RPC

`redeem_cafe_credit(member_id, cart jsonb, cash_to_apply_cents)` — runs inside a transaction:
1. Walks cart items, decrements matching `cafe_prepaid_items` first (deducts item line cost from order subtotal).
2. Validates `cash_to_apply_cents` ≤ remaining balance and ≤ remaining order total.
3. Writes `redemption_item` and `redemption_cash` ledger rows linked to `cafe_order_id`.
4. Returns `{ item_discounts, cash_applied, remaining_balance, remaining_due }`.

This prevents double-spend if two staff cash out the same member simultaneously.

### Admin UI — Member Credit Manager

New section on the existing **Member Detail Sheet** ("Cafe Credit" card) + a dedicated **Admin → Cafe → Credits** tab:

- **Balance summary**: Cash balance ($), prepaid items list ("3× Latte, 5× Acai Bowl").
- **Add Cash Credit** dialog: amount, reason → writes `cash_grant`.
- **Charge Card → Credit** dialog: amount, reason → calls existing `stripe-payment` with `charge_saved_card`, on success writes `cash_purchase`. Requires card on file.
- **Grant Prepaid Items** dialog: menu item picker + quantity → writes `item_grant`, upserts `cafe_prepaid_items`.
- **Adjust / Deduct** dialog (super_admin only): signed amount, required reason.
- **Ledger table**: paginated history with kind, amount, item, order link, who did it, when.

### POS integration (CafePOSCart)

When a member is selected:

1. Fetch their balance + prepaid items via the RPC.
2. **Auto-suggest banner** above payment method: *"Sasha has $24.50 + 3× Latte available — apply?"* with **Apply Credit** (default) and **Skip** buttons.
3. If applied, cart shows:
   - Prepaid items rendered with strikethrough price and "✓ Prepaid" badge — auto-deducted first.
   - **Cash credit slider/input** capped at min(balance, remaining total). Defaults to full apply.
4. **Payment method** becomes whatever's left after credit:
   - $0 remaining → single "Apply Credit & Complete" button, no card/cash needed.
   - >$0 remaining → existing Card-on-File / Cash buttons cover only the balance due.
5. Staff can toggle off credit entirely and pay full card/cash (override).

`handlePlaceOrder` is extended to call `redeem_cafe_credit` after the order row is created (or in the same transaction via a wrapper RPC), and Stripe is only charged for the post-credit remaining amount.

### Member-facing visibility (light touch)

- Add a "Cafe Credit" card on `/portal/dashboard` showing cash balance + prepaid item list. Read-only.
- Show "Paid with credit" line on receipts in `MyCafeOrdersCard`.

### Reporting

Update `CafeSalesReport` to split revenue into **Card**, **Cash**, **Credit-redeemed (cash)**, **Credit-redeemed (prepaid)** so credit usage isn't double-counted against revenue. Cash purchased into credit (`cash_purchase`) counts as revenue on the day it's funded, not when redeemed.

### Technical details

- **Files created**
  - `supabase/migrations/<ts>_cafe_credit_system.sql` — tables, RLS, `get_member_cafe_credit_balance`, `grant_cafe_cash_credit`, `grant_cafe_prepaid_items`, `redeem_cafe_credit`, `adjust_cafe_credit` RPCs.
  - `src/hooks/useMemberCafeCredit.ts` — balance + ledger queries, grant/redeem mutations.
  - `src/components/admin/cafe/CafeCreditPanel.tsx` — embedded in MemberDetailSheet.
  - `src/components/admin/cafe/AddCashCreditDialog.tsx`
  - `src/components/admin/cafe/ChargeCardForCreditDialog.tsx`
  - `src/components/admin/cafe/GrantPrepaidItemsDialog.tsx`
  - `src/components/admin/cafe/CafeCreditLedgerTable.tsx`
  - `src/pages/admin/CafeCredits.tsx` — dedicated tab listing all members with active credit.
  - `src/components/portal/MyCafeCreditCard.tsx`

- **Files edited**
  - `src/components/admin/CafePOSCart.tsx` — credit banner, prepaid badges, cash-apply input, dynamic payment buttons.
  - `src/pages/admin/CafePOS.tsx` — call `redeem_cafe_credit` in `handlePlaceOrder`, pass credit state through.
  - `src/components/admin/MemberDetailSheet.tsx` — mount `CafeCreditPanel`.
  - `src/pages/portal/Dashboard.tsx` — mount `MyCafeCreditCard`.
  - `src/components/admin/reports/reports/CafeSalesReport.tsx` — credit-split columns.
  - `supabase/functions/stripe-webhook/index.ts` — on successful PI with `metadata.purpose = 'cafe_credit_topup'`, write `cash_purchase` ledger row (idempotent via `stripe_payment_intent_id` unique).

- **Cafe Staff role** already gates POS access via existing `has_any_role` policies; same role gates the credit panel.
