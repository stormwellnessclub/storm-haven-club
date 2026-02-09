

## Fix: Payment Decline, Cash Activation, and ACH Charging Issues

### Three bugs identified and their root causes:

---

### Bug 1: Declined Payments Still Marking Members Active

**Root Cause**: When a subscription is created with `admin_create_member_subscription`, the edge function correctly checks the first invoice and sets `pending_activation` if unpaid. However, the `customer.subscription.updated` webhook handler unconditionally maps `subscription.status === 'active'` to member `status = 'active'` (line 951 of stripe-webhook). If Stripe's subscription transitions to "active" (even briefly, or on retry), the webhook overrides the admin's intended status.

**Fix in `supabase/functions/stripe-webhook/index.ts`**:
- In the `customer.subscription.updated` handler, when subscription status is `active`, check the member's current database status before upgrading to active
- Only auto-activate members who are `past_due` (recovering from failed payment) -- NOT members who are `pending_activation` (they haven't been properly activated yet and may need admin review)
- Members in `pending_activation` should stay there until explicitly activated by admin or through a proper checkout flow

```text
Before (current logic):
  if subscription.status === 'active' -> set member status = 'active'

After (fixed logic):
  if subscription.status === 'active':
    if member.status === 'past_due' -> set member status = 'active' (payment recovered)
    if member.status === 'pending_activation' -> keep as pending_activation (log only)
    if member.status === 'active' -> no change needed
```

---

### Bug 2: Cash/Manual Payment Not Activating Founding Members

**Root Cause**: The `ChargeItemSelector` component's manual payment path inserts a record into `manual_charges` but never updates the member's `status` to `active`. When you record a cash payment for dues, it creates an audit trail but doesn't change the member's activation state.

**Fix in `src/components/admin/ChargeItemSelector.tsx`**:
- After recording a manual payment for `membership_dues` or `initiation_fee` charge types, add an option or automatic update to set the member's status to `active` and `activated_at` timestamp
- Add a "Also activate this member" toggle that appears when recording dues for a `pending_activation` member
- When toggled on, the manual payment also updates the member's status to `active`, sets `activated_at`, and updates `subscription_status` to `none` (since there's no Stripe subscription)

**Additional props needed**: Pass member's current `status` into `ChargeItemSelector` so it can conditionally show the activation toggle.

---

### Bug 3: Cannot Charge Deana Boussi's ACH Account

**Root Cause**: The `charge_saved_card_with_3ds` action in `stripe-payment/index.ts` only queries for `type: 'card'` payment methods (line 1343). Deana has an ACH/bank account payment method (her card_brand shows "link" and card_last4 shows "0000"), so the query returns empty and throws "No payment method on file."

**Fix in `supabase/functions/stripe-payment/index.ts`**:
- In the `charge_saved_card_with_3ds` handler, query for ALL payment method types (card, us_bank_account, link) instead of just cards
- Try card first, then fall back to us_bank_account, then link
- Update the payment intent creation to use the correct payment method type
- Add `payment_method_types` to the PaymentIntent to include both card and bank account types

```text
Before:
  stripe.paymentMethods.list({ customer, type: 'card', limit: 1 })

After:
  1. Try stripe.paymentMethods.list({ customer, type: 'card' })
  2. If empty, try stripe.paymentMethods.list({ customer, type: 'us_bank_account' })
  3. If empty, try stripe.paymentMethods.list({ customer, type: 'link' })
  4. Use whichever is found, and set payment_method_types accordingly on the PaymentIntent
```

---

### Summary of File Changes

| File | Changes |
|------|---------|
| `supabase/functions/stripe-webhook/index.ts` | Fix `customer.subscription.updated` to not auto-activate `pending_activation` members -- only recover `past_due` members |
| `supabase/functions/stripe-payment/index.ts` | Fix `charge_saved_card_with_3ds` to support ACH and Link payment methods, not just cards |
| `src/components/admin/ChargeItemSelector.tsx` | Add "Also activate member" toggle for manual payments on pending members; update member status when toggled |

