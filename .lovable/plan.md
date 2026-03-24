

# Fix Kids Care Pass Fulfillment: Charge Creates Pass + Enforce Pass Requirement

## Problems

1. **Charging for Kids Care doesn't create a pass.** `ChargeItemSelector.handleCharge()` processes payment (Stripe or manual) but never inserts a `class_passes` row. So after charging $75 for a monthly pass, the parent still has no pass in the system and cannot book.

2. **No automatic pass provisioning.** The `AdminGrantPassDialog` can grant free passes, and manual inserts work, but the standard billing workflow (charge card → pass created) is broken for Kids Care.

3. **Members can't book without a pass** (correctly enforced by `useKidsCarePasses` and `useBookKidsCare`), but since charging never creates one, it's a dead end.

## Plan

### 1. Auto-create Kids Care pass after successful charge
In `ChargeItemSelector.tsx`, after a successful charge (both Stripe and manual), check if any cart item has `chargeType === "kids_care"`. For each one:
- Insert a `class_passes` row with:
  - `user_id`: the member's or non-member's user ID
  - `pass_type`: `"kids_care_monthly"` or `"kids_care_single"` based on item ID
  - `category`: `"other"`
  - `classes_total`: 16 for monthly, 1 for single
  - `classes_remaining`: same as total
  - `price_paid`: the charge amount
  - `is_member_price`: true if member, false if non-member
  - `purchased_at`: now
  - `expires_at`: 30 days for monthly, 7 days for single
  - `status`: `"active"`

This goes right after the successful charge toast, before `resetAndClose()`.

### 2. Resolve user_id for pass creation
`ChargeItemSelector` receives `member` (with `member.id`) and optionally `nonMember` (with `nonMember.userId`). For members, query `members.user_id` from `member.id`. For non-members, use `nonMember.userId` directly.

### 3. Surface "No Pass" state clearly on the member Kids Care booking modal
The modal already shows available passes and requires selection. Add a clear message when no passes exist: "You need to purchase a Kids Care Pass before booking. Ask front desk staff or purchase online." This is already partially handled but should be more prominent.

## Files to change
- `src/components/admin/ChargeItemSelector.tsx` — add pass creation after successful charge for kids_care items

## Result
- Staff charges parent → pass is automatically created and immediately usable
- Parent can then book Kids Care sessions using that pass
- No more phantom charges where money is collected but no pass exists
