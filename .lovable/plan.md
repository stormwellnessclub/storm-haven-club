

# Plan: Add "Charge Now, Activate Later" Feature

## Problem
The current "Create Subscription" dialog for membership dues only lets admins select a start date, but:
- **Future dates** delay the first charge until that date (using `billing_cycle_anchor`)
- Admins want to **charge the card today** but set the membership to **activate on a future date** (e.g., Feb 9th grand opening)

## Solution
Add a toggle in the Create Subscription dialog that allows admins to choose between:
1. **Charge on start date** (current behavior) - First charge happens when membership begins
2. **Charge now** - Immediately charges the first payment, but records the future date as the billing cycle start

---

## Technical Implementation

### 1. Update Create Subscription Dialog UI
**File:** `src/components/admin/CreateSubscriptionDialog.tsx`

Add a new toggle when a **future start date** is selected:

```text
┌─────────────────────────────────────────────────────┐
│  When should the first payment occur?               │
│                                                     │
│  ○ Charge on start date (Feb 9, 2026)              │
│    Card will be charged when membership begins      │
│                                                     │
│  ● Charge now                                       │
│    Charge card today, start benefits on Feb 9th     │
└─────────────────────────────────────────────────────┘
```

**Changes:**
- Add state: `chargeImmediately` (boolean, default `true` for future dates)
- Only show toggle when `startDate > today`
- Update `onConfirm` signature to include `chargeImmediately` flag

### 2. Update Dialog Props & Handler
**File:** `src/components/admin/CreateSubscriptionDialog.tsx`

```typescript
interface CreateSubscriptionDialogProps {
  // ... existing props
  onConfirm: (startDate: Date, chargeImmediately: boolean) => void;
}
```

### 3. Update MemberDetail Page Handler
**File:** `src/pages/admin/MemberDetail.tsx`

Pass the new flag to the backend:

```typescript
const handleCreateSubscription = async (startDate: Date, chargeImmediately: boolean) => {
  await supabase.functions.invoke('stripe-payment', {
    body: {
      action: 'admin_create_member_subscription',
      memberId: member.id,
      // ... other params
      startDate: startDate.toISOString(),
      chargeImmediately: chargeImmediately, // NEW
    }
  });
};
```

### 4. Update Backend Edge Function
**File:** `supabase/functions/stripe-payment/index.ts`

Modify `admin_create_member_subscription` action:

```typescript
case 'admin_create_member_subscription': {
  const { memberId, tier, gender, billingType, startDate, isFoundingMember, chargeImmediately } = body;
  
  const subscriptionStartDate = startDate ? new Date(startDate) : new Date();
  const now = new Date();
  const isFutureDate = subscriptionStartDate > now;

  // Build subscription params
  const subscriptionParams = {
    customer: customerStripeId,
    items: [{ price: priceId }],
    default_payment_method: paymentMethodId,
    metadata: {
      member_id: memberId,
      original_start_date: startDate,
      // ...
    }
  };

  if (isFutureDate && chargeImmediately) {
    // CHARGE NOW, but set billing cycle to future date
    // Leave billing_cycle_anchor unset (charges immediately)
    // Set the next billing date using billing_cycle_anchor_config
    subscriptionParams.billing_cycle_anchor_config = {
      day_of_month: subscriptionStartDate.getDate(),
      month: subscriptionStartDate.getMonth() + 1,
    };
    // OR use proration_behavior + backdate_start_date approach
    
    // Actually, simpler approach: Create subscription now, 
    // record original_start_date in metadata
    logStep("Charging immediately with future start date recorded");
  } else if (isFutureDate) {
    // Defer first charge to start date (current behavior)
    subscriptionParams.billing_cycle_anchor = Math.floor(subscriptionStartDate.getTime() / 1000);
  }
  // else: past or today = charge immediately (current behavior)
}
```

### 5. Update MemberDetailSheet (Quick View)
**File:** `src/components/admin/MemberDetailSheet.tsx`

Apply the same changes to maintain consistency with the full member detail page.

---

## Implementation Summary

| Component | Change |
|-----------|--------|
| `CreateSubscriptionDialog.tsx` | Add "Charge Now" toggle for future dates |
| `MemberDetail.tsx` | Pass `chargeImmediately` flag to backend |
| `MemberDetailSheet.tsx` | Same as MemberDetail |
| `stripe-payment/index.ts` | Handle `chargeImmediately` flag in subscription creation |

---

## User Experience

**Before:**
- Pick future date → First charge happens on that date

**After:**
- Pick future date → Toggle appears:
  - "Charge on start date" - Payment waits until Feb 9th
  - "Charge now" - Payment today, member activates Feb 9th

This gives admins full control over when money is collected vs. when benefits begin.

