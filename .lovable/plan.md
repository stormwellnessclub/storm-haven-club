

# Add "Create Subscription" for Already-Paid Members

## Problem Summary
Members who had their initiation fee marked as "paid" manually (because they paid via your old payment system, cash, check, etc.) currently have:
- `annual_fee_paid_at` set (showing "Paid" in the UI)
- `annual_fee_subscription_id` = null (no recurring subscription in Stripe)

This means their initiation fee won't auto-renew next year. You need a way to create a Stripe subscription for these members without charging them again immediately.

## Solution Overview
Add a new "Create Subscription" button that appears when:
- The initiation fee is marked as paid (`annual_fee_paid_at` is set)
- BUT no subscription exists (`annual_fee_subscription_id` is null)
- AND a payment method is on file

The button opens a dialog that asks how the original payment was made, then creates the Stripe subscription with the first payment delayed to the next billing cycle.

---

## User Flow

```text
Step 1: Admin sees "Paid" initiation fee status
        But notices no subscription link
        Clicks "Create Subscription"
              ↓
Step 2: Dialog opens asking payment verification:
        ┌─────────────────────────────────────────────┐
        │ Create Initiation Fee Subscription          │
        ├─────────────────────────────────────────────┤
        │                                             │
        │ Member: Jane Smith                          │
        │ Email: jane@example.com                     │
        │ Status: Initiation Fee Already Paid ✓      │
        │                                             │
        │ ─────────────────────────────────────────── │
        │                                             │
        │ How was the initiation fee paid?           │
        │ ┌─────────────────────────────────────┐    │
        │ │ ○ Stripe (previous transaction)     │    │
        │ │ ○ Old payment system (external)     │    │
        │ │ ○ Cash / Check                      │    │
        │ │ ○ Other                             │    │
        │ └─────────────────────────────────────┘    │
        │                                             │
        │ Note (optional): ___________________       │
        │                                             │
        │ ─────────────────────────────────────────── │
        │                                             │
        │ Subscription Details:                       │
        │ • Amount: $300/year (women)                │
        │ • Card: VISA •••• 4242                     │
        │ • First charge: In ~1 year (next cycle)    │
        │                                             │
        │ ⚠️ The card will NOT be charged today.     │
        │    The first charge will occur on the      │
        │    annual renewal date.                     │
        │                                             │
        │         [Cancel]    [Create Subscription]   │
        └─────────────────────────────────────────────┘
              ↓
Step 3: Admin selects payment method and confirms
              ↓
Step 4: Subscription created with billing_cycle_anchor
        set to 1 year from now (no immediate charge)
              ↓
Step 5: Success → Update member with subscription ID
```

---

## Technical Implementation

### 1. New Component: `CreateInitiationFeeSubscriptionDialog.tsx`

A new dialog component that:
- Asks how the original payment was made (radio buttons)
- Optional note field for audit purposes
- Shows subscription preview (amount, card, next billing date)
- Calls a new edge function action to create the subscription

### 2. UI Changes to MemberDetail.tsx

Update the Initiation Fee card (around line 916-965):
- When `annual_fee_paid_at` is set BUT `annual_fee_subscription_id` is null:
  - Show "Paid" status
  - Show "Create Subscription" button below
  - Show warning about no recurring subscription

**Updated Initiation Fee Card:**
```
┌─────────────────────────────────────────┐
│ Initiation Fee                          │
│ ✓ Paid                                  │
│                                         │
│ ⚠️ No recurring subscription            │
│ [Create Subscription]                   │
└─────────────────────────────────────────┘
```

### 3. New Edge Function Action: `admin_create_initiation_fee_subscription_no_charge`

This action will:
1. Verify admin role
2. Get member and validate they have `annual_fee_paid_at` set
3. Get their Stripe customer and payment method
4. Create subscription with `billing_cycle_anchor` set to 1 year from now
5. Update `annual_fee_subscription_id` in database
6. Record in audit log with original payment method info

Key difference from existing action:
- Uses `billing_cycle_anchor` to prevent immediate charge
- Only allowed when `annual_fee_paid_at` is already set
- Records the original payment method in metadata

---

## File Changes

| File | Changes |
|------|---------|
| `src/components/admin/CreateInitiationFeeSubscriptionDialog.tsx` | **NEW** - Dialog with payment method verification |
| `src/pages/admin/MemberDetail.tsx` | Add "Create Subscription" button when paid but no subscription |
| `supabase/functions/stripe-payment/index.ts` | Add `admin_create_initiation_fee_subscription_no_charge` action |

---

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| No card on file | Button disabled, tooltip explains |
| Already has subscription | Button not shown |
| Not marked as paid | Uses existing "Charge" button instead |
| Subscription creation fails | Error toast, dialog stays open |

---

## Payment Method Options

The dialog will offer these options for "How was the initiation fee paid?":

1. **Stripe (previous transaction)** - They paid via Stripe before, just need subscription link
2. **Old payment system** - External payment portal (Square, PayPal, etc.)
3. **Cash / Check** - In-person payment
4. **Other** - Any other method

This selection is stored in the subscription metadata for audit purposes.

