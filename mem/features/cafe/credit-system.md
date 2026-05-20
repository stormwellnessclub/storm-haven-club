---
name: Cafe Credit System
description: Member-only cafe wallet — cash balance, prepaid items, card-funded top-ups, redeemed atomically at POS
type: feature
---

Member-only credit system layered on Cafe POS.

**Tables:** `cafe_credit_ledger` (append-only audit, unique `stripe_payment_intent_id` for idempotency) and `cafe_prepaid_items` (current per-member counts). Balance = SUM(amount_cents) from ledger.

**RPCs (all SECURITY DEFINER, gated by `has_any_role` for cafe_staff/manager/admin/super_admin; adjust is super_admin only):**
- `get_member_cafe_credit_balance(_member_id)` → `{ balance_cents, prepaid_items[] }`
- `grant_cafe_cash_credit`, `record_cafe_cash_purchase`, `grant_cafe_prepaid_items`, `adjust_cafe_credit`
- `redeem_cafe_credit(_member_id, _cafe_order_id, _cart_items jsonb, _cash_to_apply_cents)` — atomic: locks prepaid rows, deducts prepaid items first, then applies cash up to balance. Cart payload: `{ menu_item_id, quantity, unit_price_cents, name }[]`.

**POS flow (CafePOSCart):** when selected customer is a member, fetches balance. Shows amber "Cafe Credit Available" banner with Apply/Skip toggle. Prepaid items auto-deduct first, then cash credit (editable input, defaults to full apply). Remaining due drives payment method buttons; $0 remaining hides them and shows "Apply Credit & Complete". Processing fee only computed on remainder.

**CafePOS.handlePlaceOrder** creates the order row first, then calls `redeemCafeCredit`, then charges Stripe for remainder. Credit redemption failure does NOT block the charge (order exists, errors toasted).

**No expiration, non-refundable** per product spec. Members-only.

**UI:** `CafeCreditPanel` in MemberDetailSheet Membership tab (cash/card/items/adjust + ledger dialog). `MyCafeCreditCard` on portal Dashboard (read-only).
