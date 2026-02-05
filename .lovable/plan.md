

# Class Booking Payment Enforcement - Complete Implementation Plan

## Problem Summary

The current class booking system has a **critical gap**: users can select "Pay at front desk" (cash) as a payment method and book classes **without any actual payment or prepaid credits/passes**. This bypasses the payment requirement entirely.

**Evidence from database**:
- Several bookings exist with `payment_method: cash` and `credits_used: 0`
- No validation prevents unpaid bookings

**Current Flow Analysis**:

| Payment Method | Requires Pre-Payment? | Current Behavior |
|----------------|----------------------|------------------|
| `credits` | Yes | Diamond members use included class credits |
| `pass` | Yes | User has pre-purchased class pass |
| `cash` | **NO** | Books immediately, expects front desk payment |

## Solution: Remove Cash Payment & Enforce Pre-Payment

### Phase 1: Remove "Pay at Front Desk" Option (Frontend)

**File: `src/components/booking/BookingModal.tsx`**

Remove the "cash" payment option from the BookingModal. Users must either:
1. Use Diamond member credits (if available)
2. Use a pre-purchased class pass
3. **Purchase a class pass first** (redirect to `/class-passes` page)

```
Current options:
- Diamond Member Credit ✓
- Class Pass ✓
- Pay at front desk ✗ (REMOVE)
- [New] Purchase a Class Pass → redirect
```

### Phase 2: Backend Validation (Edge Function & Database)

**File: `supabase/migrations/` (new migration)**

Update the `create_atomic_class_booking` function to reject `cash` as a payment method:

```sql
-- Add validation at start of function
IF _payment_method = 'cash' THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Cash payments are not accepted for online bookings. Please purchase a class pass first.'
  );
END IF;
```

This provides server-side enforcement even if someone bypasses the UI.

### Phase 3: Update Booking Hook Validation

**File: `src/hooks/useBooking.ts`**

Add client-side validation before calling the RPC function:

```typescript
// Validate payment method - reject cash
if (paymentMethod === "cash") {
  throw new Error("Please purchase a class pass or use your member credits to book this class.");
}

// Ensure user has valid payment option
if (paymentMethod === "credits" && !memberCreditId) {
  throw new Error("No available class credits. Please purchase a class pass.");
}

if (paymentMethod === "pass" && !passId) {
  throw new Error("Please select a class pass to use for this booking.");
}
```

### Phase 4: UI Flow for No Payment Options

**File: `src/components/booking/BookingModal.tsx`**

When user has no valid payment options (no credits AND no passes), show:

1. Clear message: "You need a class pass to book"
2. Primary CTA: "Purchase Class Pass" button → redirects to `/class-passes`
3. Secondary link to class pass pricing information

```
┌─────────────────────────────────────────────────────────┐
│ Book: Reformer Sculpt                                   │
├─────────────────────────────────────────────────────────┤
│ Saturday, Feb 8, 2026 at 9:00 AM                       │
│ 50 min • Studio A • 6 spots remaining                  │
├─────────────────────────────────────────────────────────┤
│ ⚠️ No payment method available                         │
│                                                         │
│ To book this class, you need:                          │
│ • Diamond membership credits (included monthly), or    │
│ • A pre-purchased class pass                           │
│                                                         │
│ [Purchase Class Pass]  [View Pricing]                  │
└─────────────────────────────────────────────────────────┘
```

### Phase 5: Verify Stripe Webhook Integration

**File: `supabase/functions/stripe-webhook/index.ts`**

The webhook already correctly handles class pass creation on `checkout.session.completed`:
- ✅ Creates `class_passes` record with correct category
- ✅ Sets `classes_remaining` correctly (1 or 10)
- ✅ Sets proper expiration date
- ✅ Records member status for pricing verification

**Verified Stripe Secrets**: All required secrets are configured:
- `STRIPE_SECRET_KEY` ✅
- `STRIPE_WEBHOOK_SECRET` ✅

---

## Technical Implementation Details

### BookingModal Changes

```typescript
// src/components/booking/BookingModal.tsx

// Determine available payment options
const canUseMemberCredits = creditsData?.hasClassCredits;
const canUsePass = creditsData?.availablePasses && creditsData.availablePasses.length > 0;
const hasNoPaymentOptions = !canUseMemberCredits && !canUsePass;

// Remove cash option entirely from RadioGroup
// Only show: credits (if available) and passes (if available)

// When no options available, show purchase prompt instead of booking form
{hasNoPaymentOptions && user && (
  <div className="space-y-4">
    <Alert variant="warning">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>No payment method available</AlertTitle>
      <AlertDescription>
        Purchase a class pass to book this class.
      </AlertDescription>
    </Alert>
    <Button onClick={() => navigate('/class-passes')} className="w-full">
      Purchase Class Pass
    </Button>
  </div>
)}
```

### Database Migration

```sql
-- Enforce payment validation in atomic booking function
CREATE OR REPLACE FUNCTION public.create_atomic_class_booking(
  _session_id uuid,
  _user_id uuid,
  _payment_method text,
  _member_credit_id uuid DEFAULT NULL,
  _pass_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- ... existing declarations ...
BEGIN
  -- ADDED: Reject cash payments
  IF _payment_method NOT IN ('credits', 'pass') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid payment method. Please use class credits or a class pass.'
    );
  END IF;
  
  -- ADDED: Require credit ID for credits payment
  IF _payment_method = 'credits' AND _member_credit_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No class credits specified'
    );
  END IF;
  
  -- ADDED: Require pass ID for pass payment
  IF _payment_method = 'pass' AND _pass_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No class pass specified'
    );
  END IF;
  
  -- ... rest of existing function ...
END;
$$;
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/booking/BookingModal.tsx` | Remove cash option, add "no payment" state with purchase CTA |
| `src/hooks/useBooking.ts` | Add client-side payment method validation |
| `supabase/migrations/` (new) | Update `create_atomic_class_booking` to reject cash payments |

---

## Expected Outcome

1. **No booking without payment**: Users cannot book without prepaid credits/passes
2. **Clear path to purchase**: When no payment available, users are directed to purchase page
3. **Server-side enforcement**: Database function validates payment even if UI is bypassed
4. **Existing flow preserved**: Diamond members use credits, pass holders use passes
5. **Stripe integration verified**: Webhooks correctly create passes after purchase

---

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| User has no credits AND no passes | Show "Purchase Class Pass" prompt |
| User has credits but no passes | Allow credits option only |
| User has passes but no credits | Allow pass option only |
| User has both | Show both options, user selects |
| Non-logged-in user | Prompt to sign in first |
| Diamond member with 0 remaining credits | Must purchase additional pass |

