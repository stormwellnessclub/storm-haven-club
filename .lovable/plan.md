## Problem

Inside **Front Desk → Members**, clicking a member opens `MemberDetailSheet`, but:

1. **"Sell" and "Process" buttons in the sheet header do nothing.** Their `onClick` handlers in `src/components/admin/MemberDetailSheet.tsx` (lines ~745–762) are empty stubs with the comment "Will be handled by parent component" — nothing was ever wired up.
2. **Charging a saved card fails for front desk staff.** The `charge_saved_card` case in `supabase/functions/stripe-payment/index.ts` calls `assertStaff()` with its default role list `['super_admin', 'admin', 'manager']`, so `front_desk` is rejected. That's why the "Charge Saved Card" flow (used for a cafe/walk-in sale against a member's card on file) can't complete. `charge_saved_card_with_3ds` has the same gap.

Listing cards already allows front desk (`assertOwnerOrStaff` includes `front_desk`), so cards should display — but the charge step blocks them.

## Fix

### 1. Wire the header buttons in `MemberDetailSheet`

In `src/components/admin/MemberDetailSheet.tsx`:

- **Process** button → open the existing "Charge Saved Card" dialog (`setShowChargeDialog(true)`), same dialog the Payments tab opens. This lets front desk charge any amount to the member's card on file for a cafe/POS sale without leaving the member sheet.
- **Sell** button → navigate to `/frontdesk/pos` (or `/admin/pos` for admins) with the member pre-selected via router `state`, so the POS cart opens with this customer already chosen.
- Both buttons visible in `frontdesk` viewer mode.

### 2. Pre-select the customer in Front Desk POS

In `src/pages/admin/FrontDeskPOS.tsx`:

- Read `location.state.presetCustomer` on mount and, if present, call `setSelectedCustomer(...)` so the cart is already tied to that member. Clear the state after applying so a refresh doesn't re-inject it.

### 3. Allow `front_desk` to charge a saved card

In `supabase/functions/stripe-payment/index.ts`:

- `case 'charge_saved_card'`: change `await assertStaff();` to `await assertStaff(['super_admin', 'admin', 'manager', 'front_desk']);`
- `case 'charge_saved_card_with_3ds'`: same change.

No other role gates need to move — RLS on `manual_charges` / logging already tolerates staff roles.

## Out of scope

- No changes to the Payments tab UI, card-list rendering, or Stripe products.
- No changes to admin role permissions elsewhere.
- No changes to the cafe menu / POS cart itself — only the entry point from the member sheet and the backend role check.

## Verification

- As a front desk user: search a member with a card on file, open the sheet, click **Process** → charge dialog opens, enter $5 + description → success toast, charge appears in `manual_charges`.
- Click **Sell** → routes to `/frontdesk/pos` with the member already selected in the POS customer field; add a latte, check out on saved card → order created and card charged.
- As an admin, both buttons still work and route to `/admin/pos`.