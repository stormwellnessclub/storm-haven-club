## Diagnosis

There are **two distinct bugs** at play here.

### Bug 1: Ayana's 10-class pass was charged but never created
- On 2026-04-08 18:52 UTC, manual charge `pi_3TK1DSLyZrsSqLhs13yRlD31` for **$175.39** went through with description `"10-pack class pass - Pilates/Cycling"`. The Stripe charge succeeded, but `class_passes` only contains her two **Kids Care** passes from 12 minutes earlier — no 10-pack row exists.
- **Root cause:** `src/components/admin/ChargeItemSelector.tsx` has an auto-fulfillment step `createKidsCarePassesFromCart()` that runs after `handleCharge` and inserts `class_passes` rows for `chargeType: "kids_care"` items. **There is no equivalent fulfillment for `chargeType: "class_pass"` items** (singles or 10-packs). Stripe captures money, but no pass row is ever created — staff have to grant it manually and may not realize.

### Bug 2: Kids Care passes show up when booking adult "other" classes
- Kids Care passes are stored as `category: "other"`, `pass_type: "kids_care_monthly"`.
- `useAvailableCreditsForCategory` filters via `isPassValidForClass(pass.category, classCategory)`. For an "other" class, the valid pass categories are `['aerobics', 'other', 'pilates_cycling']`.
- Since Kids Care passes have `category: "other"`, they pass the filter and appear in the BookingModal's pass dropdown for regular adult classes — exactly what Ayana saw.
- Kids Care passes should **only** be redeemable through the Kids Care booking flow, never adult classes.

## Fix Plan

### 1. Backfill Ayana's missing 10-pack class pass
Insert the missing `class_passes` row matching the paid charge:
- `user_id`: `112b680c-6530-4d7a-b88b-05c9d545d9cc`
- `member_id`: her active member id
- `category`: `pilates_cycling`
- `pass_type`: `10-pack`
- `classes_total`: 10, `classes_remaining`: 10
- `is_member_price`: true
- `price_paid`: 170 (the line item)
- `purchased_at`: 2026-04-08 18:52:43 UTC (charge timestamp)
- `expires_at`: ~6 months from purchase (matching standard 10-pack policy — will confirm against existing 10-packs)
- `status`: `active`

### 2. Add auto-fulfillment for `class_pass` charges in `ChargeItemSelector.tsx`
Mirror `createKidsCarePassesFromCart` with a new `createClassPassesFromCart` helper that:
- Filters `cartItems` for `chargeType === "class_pass"`.
- Maps each item key to its category, pass_type, classes_total, expiration:
  - `single_member_pilates` / `single_nonmember_pilates` → `pilates_cycling`, `single`, 1 class, 30-day exp
  - `single_member_other` / `single_nonmember_other` → `other`, `single`, 1 class, 30-day exp
  - `10pack_member_pilates` / `10pack_nonmember_pilates` → `pilates_cycling`, `10-pack`, 10 classes, 6-month exp
  - `10pack_member_other` / `10pack_nonmember_other` → `other`, `10-pack`, 10 classes, 6-month exp
- Inserts `class_passes` rows after a successful charge (called right after `createKidsCarePassesFromCart` in `handleCharge`).
- Invalidates `class-passes` query so the UI refreshes immediately.
- Toasts a confirmation per pass created.

This guarantees that any future `ChargeItemSelector` class-pass sale (whether saved-card or manual payment) creates the pass row atomically with the charge.

### 3. Exclude Kids Care passes from adult class booking
Update `src/hooks/useUserCredits.ts` → `useAvailableCreditsForCategory`:
- After `isPassValidForClass(pass.category, classCategory)`, also exclude any pass whose `pass_type` starts with `kids_care` (e.g. `kids_care_monthly`, `kids_care_single`).
- Net effect: Kids Care passes still appear in the Kids Care booking flow (which queries them separately), but are hidden from the regular `BookingModal` pass dropdown.

### Files touched
- `src/components/admin/ChargeItemSelector.tsx` — add `createClassPassesFromCart` helper and call it in `handleCharge`.
- `src/hooks/useUserCredits.ts` — filter out `kids_care*` pass_types in `useAvailableCreditsForCategory`.
- Database migration — backfill Ayana's 10-pack `class_passes` row.

### Out of scope (not changing now)
- The single-pass and 10-pack logic in the public `/class-passes` Stripe Checkout flow — that path uses `stripe-payment` edge function with its own webhook fulfillment and was working correctly before; only the admin `ChargeItemSelector` saved-card path was missing fulfillment.
- A historical sweep of other members who may have been charged for class passes via `ChargeItemSelector` without receiving them. Happy to run an audit query as a follow-up if you want — would search `manual_charges` for `class pass` descriptions and cross-reference against `class_passes` rows.