

## Add Cash Payment Options: POS and Super-Admin Activation

### Summary

Two separate cash payment features:

1. **Front Desk POS** -- Add a "Cash" payment option so any admin/staff can record a cash sale for drinks, food, etc. The system calculates tax, shows the total, and lets you enter the amount received to display change owed.

2. **Super-Admin Only: Cash Activation** -- Allow only super admins to activate a member's first month subscription using cash payment (bypassing Stripe charge) when the member doesn't have their card but does have one on file for future billing.

---

### Part 1: Cash Payment in POS

**File: `src/components/admin/CafePOSCart.tsx`**

- Add a payment method toggle: **"Card on File"** vs **"Cash"**
- When "Cash" is selected:
  - Tax is always included in the total (same MI 6% calculation)
  - No Stripe processing fee is added
  - Show a "Cash Received" input field where staff enters the amount the customer handed over
  - Display "Change Due" calculated as (cash received - total)
  - The main button reads **"Record Cash Sale -- $X.XX"** instead of "Charge Card on File"
- When no member is selected or member has no card, "Cash" is the default/only option

**File: `src/pages/admin/FrontDeskPOS.tsx`**

- Accept a `paymentMethod` parameter from the cart (either `"cash"` or `"card"`)
- When `paymentMethod === "cash"`: skip the Stripe charge call entirely, go straight to creating the order record
- Set `payment_method` on the cafe order to `"cash"` so it shows correctly in the order queue

**File: `src/hooks/useCafeOrder.ts`**

- Add `"cash"` to the `paymentMethod` union type: `"card" | "member_account" | "cash"`

---

### Part 2: Super-Admin Cash Activation for First Month

**File: `src/components/admin/SingleActivationDialog.tsx`**

- Add a new checkbox option (visible only when the member has a card on file): **"First month paid in cash"**
- This checkbox is only visible to super admins (pass `isSuperAdmin` as a prop)
- When checked:
  - The system activates the member immediately
  - Creates the Stripe subscription but sets `billing_cycle_anchor` to one month from start date (so the first Stripe charge happens in month 2)
  - Records a manual charge entry noting "First month dues -- Cash" in the `manual_charges` table
  - The initiation fee handling remains unchanged (separate from this)
- Add a note field for cash details (e.g., "Received $500 cash from member")

**Files that use SingleActivationDialog** (to pass `isSuperAdmin` prop):

- Check where `SingleActivationDialog` is rendered (likely `src/pages/admin/Applications.tsx`) and pass the `isSuperAdmin` boolean from `useUserRoles()`

---

### Technical Details

| File | Change |
|------|--------|
| `src/components/admin/CafePOSCart.tsx` | Add Cash/Card toggle, cash received input, change due display |
| `src/pages/admin/FrontDeskPOS.tsx` | Skip Stripe charge when payment method is cash, pass method to order |
| `src/hooks/useCafeOrder.ts` | Add "cash" to payment method type |
| `src/components/admin/SingleActivationDialog.tsx` | Add super-admin-only "First month paid in cash" checkbox with note field |
| Parent of SingleActivationDialog | Pass `isSuperAdmin` prop |

### What stays the same

- Tax calculation (MI 6%) applies to both cash and card POS sales
- The existing "Mark Paid" dialog for initiation fees (already supports cash)
- All existing Stripe charge logic for card-on-file members
- The order queue and order history display

