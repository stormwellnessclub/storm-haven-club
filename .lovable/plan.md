

## Two Issues to Fix

### Issue 1: Front Desk POS Not Charging via Stripe

The Front Desk POS currently only creates a database record in `cafe_orders`. It does not charge the member's card. The fix integrates the existing `stripe-payment` edge function (action: `charge_saved_card`) into the POS checkout flow.

**Changes to `src/pages/admin/FrontDeskPOS.tsx`:**
- Look up the selected member's `stripe_customer_id` from the `members` table
- After calculating the total, call `supabase.functions.invoke("stripe-payment", { action: "charge_saved_card", ... })` with the member's Stripe customer ID, amount in cents, and a description like `"Front Desk POS - [item names]"`
- Only create the `cafe_orders` record after the Stripe charge succeeds
- Show appropriate error toasts if the charge fails (e.g. card declined)
- For non-member / no-card-on-file orders, keep the current behavior (record only, no Stripe charge)

**Changes to `src/components/admin/CafePOSCart.tsx`:**
- Accept a `selectedMember` prop that includes `stripeCustomerId` (not just name + cardOnFile)
- Update the button label to differentiate between "Charge Card on File" (Stripe) vs "Record Order" (no card)

**Changes to member lookup logic:**
- When a member is selected via search, query the `members` table for `stripe_customer_id` and `card_brand`/`card_last4` so the POS knows whether a real Stripe charge is possible

---

### Issue 2: Settings Page Shows Hardcoded "Connected" Status

The Settings page has a hardcoded green "Connected" badge for Stripe. It should verify the connection at runtime.

**Changes to `src/pages/admin/Settings.tsx`:**
- Add a `useEffect` that calls the existing `stripe-config` edge function on mount
- If the function returns a valid publishable key (starts with `pk_`), show the green "Connected" badge
- If it errors or returns no key, show a red/amber "Not Connected" badge with a message
- Add a loading state while the check runs

---

### Technical Details

| File | Change |
|------|--------|
| `src/pages/admin/FrontDeskPOS.tsx` | Add Stripe charge via `stripe-payment` edge function before creating order; query member's `stripe_customer_id` on selection |
| `src/components/admin/CafePOSCart.tsx` | Extend `selectedMember` type to include `stripeCustomerId`; update button labels |
| `src/pages/admin/Settings.tsx` | Replace hardcoded Stripe status with a live check via `stripe-config` edge function |

No database or edge function changes are needed -- this uses existing infrastructure.
