
# Plan: Fix Receipt Accuracy & Add Separate First Charge Date Option

## Overview

This plan addresses two issues:
1. **Fix misleading receipts** - The receipt email should accurately reflect when payment was/will be processed
2. **Add independent charge date** - Allow admin to specify a "First Charge Date" separately from "Benefits Start Date"

---

## Problem Analysis

### Current Receipt Issue
When you select "Charge on start date" (Feb 14th) for a member with benefits starting Feb 9th:
- The backend uses `billing_cycle_anchor` to delay the charge to Feb 14th
- But the receipt email uses `new Date()` (Feb 9th) as `paymentDate`
- This creates a misleading receipt showing payment on a date no charge occurred

### Missing Flexibility
Currently, the admin can only choose:
- Charge now + benefits later
- Charge on benefits start date

But you need:
- Charge on Feb 14th
- Benefits start Feb 9th

This requires a **separate first charge date picker**.

---

## Solution Design

### Part 1: Fix Receipt to Show Actual Charge Date

**File: `supabase/functions/stripe-payment/index.ts`** (lines ~2545-2575)

Update the receipt email logic to correctly determine when payment was/will be processed:

```text
Current Logic (WRONG):
┌─────────────────────────────────────────────────────────────┐
│  const paymentDateFormatted = new Date().toLocaleDateString │
│  // ALWAYS shows today's date, even if charge is deferred   │
└─────────────────────────────────────────────────────────────┘

New Logic (CORRECT):
┌─────────────────────────────────────────────────────────────┐
│  let actualPaymentDate: Date;                               │
│                                                             │
│  if (isStartDateInFuture && !chargeImmediately) {           │
│    // Charge is DEFERRED - don't send receipt now           │
│    // Webhook will send receipt when payment actually occurs│
│  } else {                                                   │
│    // Charge happened NOW (or backdated)                    │
│    actualPaymentDate = new Date();                          │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

**Key Change**: When `chargeImmediately=false` with a future start date, we should NOT send a receipt immediately. The webhook (`invoice.payment_succeeded`) will send the receipt when the actual charge occurs.

---

### Part 2: Add Independent "First Charge Date" Option

**Files to Modify:**
1. `src/components/admin/CreateSubscriptionDialog.tsx` - Add second date picker
2. `supabase/functions/stripe-payment/index.ts` - Accept and use `firstChargeDate`
3. `supabase/functions/send-email/index.ts` - Update receipt template to handle both dates

**New UI Flow:**

```text
┌─────────────────────────────────────────────────────────────┐
│  Create Subscription                                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Benefits Start Date *     │  First Charge Date             │
│  ┌─────────────────────┐   │  ┌─────────────────────────┐   │
│  │ Feb 9, 2024         │   │  │ ☑ Feb 14, 2024          │   │
│  └─────────────────────┘   │  └─────────────────────────┘   │
│  When member can access    │  When card will be charged      │
│  club and benefits         │  (Leave blank to charge now)    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ⚠️ Note: Card will be charged on Feb 14, 2024.       │   │
│  │    Benefits begin on Feb 9, 2024.                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Backend Logic Update:**

```typescript
// New parameter structure
interface AdminCreateSubscriptionRequest {
  memberId: string;
  tier: string;
  gender: string;
  startDate: string;        // Benefits start date
  firstChargeDate?: string; // Optional - defaults to today if not provided
  // ... other fields
}

// Billing logic
if (firstChargeDate && new Date(firstChargeDate) > now) {
  // Use billing_cycle_anchor to delay charge
  subscriptionParams.billing_cycle_anchor = Math.floor(new Date(firstChargeDate).getTime() / 1000);
  
  // DON'T send receipt now - webhook will send it when charge occurs
  skipReceiptEmail = true;
}
```

---

## Implementation Details

### 1. CreateSubscriptionDialog.tsx Changes

**New State:**
```typescript
const [startDate, setStartDate] = useState<Date>(...);        // Benefits start
const [firstChargeDate, setFirstChargeDate] = useState<Date | null>(null);  // When to charge
const [useCustomChargeDate, setUseCustomChargeDate] = useState(false);
```

**New UI Section:**
- Checkbox: "Schedule first charge for a different date"
- When checked, show second date picker for charge date
- Validation: Charge date must be today or in future (Stripe limitation)

**Updated onConfirm call:**
```typescript
onConfirm(startDate, firstChargeDate);
// Instead of: onConfirm(startDate, chargeImmediately);
```

### 2. stripe-payment Edge Function Changes

**Update `admin_create_member_subscription` case:**

```typescript
// Accept new parameter
const { memberId, tier, gender, billingType, startDate, firstChargeDate, isFoundingMember } = body;

const benefitsStartDate = new Date(startDate);
const chargeDate = firstChargeDate ? new Date(firstChargeDate) : new Date();
const isChargeDateInFuture = chargeDate > now;

// Set billing anchor based on charge date (not benefits date)
if (isChargeDateInFuture) {
  subscriptionParams.billing_cycle_anchor = Math.floor(chargeDate.getTime() / 1000);
}

// Store both dates in metadata for clarity
subscriptionParams.metadata = {
  ...subscriptionParams.metadata,
  benefits_start_date: startDate,
  first_charge_date: firstChargeDate || new Date().toISOString().split('T')[0],
};
```

**Receipt Email Logic:**

```typescript
// Only send receipt if charging NOW
const isChargingNow = !isChargeDateInFuture;

if (isChargingNow && memberData.email) {
  const receiptData = {
    paymentDate: new Date().toLocaleDateString(...),
    benefitsStartDate: benefitsStartDate > new Date() 
      ? benefitsStartDate.toLocaleDateString(...) 
      : undefined,
    // ... other fields
  };
  
  await supabase.functions.invoke('send-email', {
    body: { type: 'charge_confirmation', to: memberData.email, data: receiptData }
  });
}
// If charge is deferred, webhook will send receipt when payment occurs
```

### 3. Updated Receipt Email Content

**When Benefits Start Date differs from Payment Date:**

```text
┌─────────────────────────────────────────────────────────────┐
│  Receipt Details                                             │
├─────────────────────────────────────────────────────────────┤
│  Description      Membership Dues - Platinum                 │
│  Amount           $350.00                                    │
│  Payment Date     Feb 14, 2024                               │
│  Benefits Start   Feb 9, 2024    ← NEW ROW (when different) │
│  Next Billing     Mar 14, 2024                               │
│  Payment Method   Visa •••• 4242                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/CreateSubscriptionDialog.tsx` | Add "First Charge Date" picker, update onConfirm signature |
| `src/pages/admin/MemberDetail.tsx` | Update handleCreateSubscription to pass firstChargeDate |
| `supabase/functions/stripe-payment/index.ts` | Handle firstChargeDate, fix receipt timing logic |
| `supabase/functions/send-email/index.ts` | Already supports benefitsStartDate - no changes needed |

---

## User Experience Summary

### After Implementation

**Admin Flow:**
1. Select "Benefits Start Date": Feb 9th (when member can use club)
2. Optionally check "Schedule first charge for different date"
3. Select "First Charge Date": Feb 14th
4. Click "Create Subscription"

**Member Experience:**
- Benefits active from Feb 9th
- Card charged on Feb 14th
- Receipt email sent on Feb 14th with accurate date

**Receipt Content:**
- "Payment Date: Feb 14, 2024"
- "Benefits Started: Feb 9, 2024" (only shown if different)
- "Next Billing: Mar 14, 2024"

---

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| Benefits in past, charge now | Charge immediately, send receipt now |
| Benefits today, charge now | Charge immediately, send receipt now |
| Benefits future, charge now | Charge immediately, send receipt with "Benefits Start" date |
| Benefits in past, charge future | Error - not allowed (benefits must be before or on charge) |
| Benefits future, charge future | Defer charge, webhook sends receipt when payment occurs |
| Same date for both | Standard flow - charge and benefits on same day |
