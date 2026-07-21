## Root cause

Cafe self-orders from the member portal fail with **"Unauthorized: Staff access required"**.

`CafeOrderContent.handleConfirmOrder` (member path) calls the `stripe-payment` edge function with `action: "charge_saved_card"`. That action currently gates on `assertStaff(['super_admin','admin','manager','front_desk'])` at `supabase/functions/stripe-payment/index.ts:1701`, so any logged-in member without a staff role is rejected — even when charging their own card on file for their own cafe order.

Confirmed: `list_payment_methods` already uses `assertOwnerOrStaff(memberId)`, which is why the saved card list loads fine but checkout fails on the charge itself.

## Fix

Swap the `charge_saved_card` gate from staff-only to owner-or-staff, matching the existing helper used by `list_payment_methods`.

In `supabase/functions/stripe-payment/index.ts` inside `case 'charge_saved_card':`
- Replace `await assertStaff(['super_admin','admin','manager','front_desk']);`
- With `await assertOwnerOrStaff(memberId, ['super_admin','admin','manager','front_desk']);`

This keeps all existing staff paths (Front Desk POS, admin manual charges) working, and additionally allows a signed-in member to charge only their own card on their own member record — the helper looks up `members.user_id` server-side and only accepts staff otherwise, so a member cannot pass someone else's `memberId`.

`charge_nonmember_saved_card` and `charge_saved_card_with_3ds` are not part of the member cafe path and are out of scope.

## Verification

1. Deploy `stripe-payment`.
2. As a regular member on `/member/cafe`, add an item, hit Checkout with a saved card → order completes, receipt sent, no "staff access" error.
3. As Front Desk on `/frontdesk` POS, charge a member's card on file → still works.
4. Confirm a member cannot supply a different member's `memberId` (helper rejects and falls through to `assertStaff`, returning 401).
