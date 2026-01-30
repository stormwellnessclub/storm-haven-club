
## Plan: Enforce Minimum One Payment Method on File

### Overview
Prevent members from deleting their last payment method in the member portal. At least one card must remain on file for autopay/subscription billing. This will be enforced at both the frontend (UI) and backend (edge function) levels.

---

### File 1: `src/pages/member/PaymentMethods.tsx`

**Current behavior:** Members can delete any card, including their last one.

**Changes:**

1. **Add validation before showing delete confirmation** (around line 340)
   - Check if `paymentMethods.length === 1` when user clicks delete
   - If it's the last card, show an error toast instead of the delete dialog

2. **Disable delete button for last card with tooltip**
   - When only 1 card exists, disable the delete button
   - Add a tooltip explaining "You must keep at least one payment method on file for billing"

3. **Update the delete confirmation dialog** (lines 384-403)
   - Add extra warning if trying to delete the last card (though we'll block this in the UI)

**Code changes:**
```tsx
// Before setCardToDelete, add check:
const handleAttemptDelete = (method: PaymentMethod) => {
  if (paymentMethods.length === 1) {
    toast.error("You must keep at least one payment method on file for billing.");
    return;
  }
  setCardToDelete(method);
};

// Update delete button to show disabled state + tooltip for last card:
const isLastCard = paymentMethods.length === 1;

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <span>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => handleAttemptDelete(method)}
          disabled={deletingCardId === method.id || isLastCard}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </span>
    </TooltipTrigger>
    {isLastCard && (
      <TooltipContent>
        <p>You must keep at least one payment method on file</p>
      </TooltipContent>
    )}
  </Tooltip>
</TooltipProvider>
```

---

### File 2: `src/components/member/InlineBillingSection.tsx`

**Current behavior:** Same issue - delete button has no minimum card check.

**Changes:**

1. **Add the same validation logic** before showing delete confirmation
2. **Disable delete button when only 1 card exists**
3. **Add tooltip explaining the requirement**

**Code changes (similar to PaymentMethods.tsx):**
```tsx
const isLastCard = paymentMethods.length === 1;

// Block deletion attempt for last card
const handleAttemptDelete = (method: PaymentMethod) => {
  if (paymentMethods.length === 1) {
    toast.error("You must keep at least one payment method on file for billing.");
    return;
  }
  setCardToDelete(method);
};
```

---

### File 3: `supabase/functions/stripe-payment/index.ts`

**Current behavior:** The `detach_payment_method` action (lines 1153-1178) detaches without checking card count.

**Changes:** Add backend validation as a safety net

1. **Before detaching, list all payment methods for the customer**
2. **If only 1 payment method exists, return an error**
3. **This ensures the rule is enforced even if someone bypasses the frontend**

**Code changes (in the `detach_payment_method` case, after line 1168):**
```typescript
// Check if this is the last payment method
const paymentMethods = await stripe.paymentMethods.list({
  customer: customerId,
  type: 'card',
});

if (paymentMethods.data.length <= 1) {
  throw new Error("Cannot remove your last payment method. At least one card must remain on file for billing.");
}

// Detach the payment method
await stripe.paymentMethods.detach(paymentMethodId);
```

---

### Summary of Changes

| File | Action | Purpose |
|------|--------|---------|
| `src/pages/member/PaymentMethods.tsx` | MODIFY | Block UI deletion of last card with toast + disabled button |
| `src/components/member/InlineBillingSection.tsx` | MODIFY | Same UI blocking for inline billing section |
| `supabase/functions/stripe-payment/index.ts` | MODIFY | Backend safety check to prevent last card deletion |

---

### User Experience

**When member has 2+ cards:**
- Delete button works normally
- Confirmation dialog appears
- Card can be removed

**When member has only 1 card:**
- Delete button is visually disabled (grayed out)
- Hovering shows tooltip: "You must keep at least one payment method on file"
- Clicking shows toast: "You must keep at least one payment method on file for billing."
- Backend also rejects the request if somehow bypassed

---

### Technical Notes
- Tooltip component already imported in PaymentMethods.tsx via the UI library
- Toast notifications use the existing `sonner` library
- Backend check uses Stripe's `paymentMethods.list` to count cards before deletion
