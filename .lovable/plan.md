
# Fix "Card Declined" Message When Admin Saves Card

## Summary

When an admin saves a card on file in the application portal, Stripe's SetupIntent validation can return "Your card was declined" even though no charge is being attempted. This confusing message makes users think a charge failed when the system is only trying to save the card for future use.

---

## Problem Analysis

Stripe's `confirmSetup()` method validates cards before saving them. Some card issuers perform a $0 or $1 pre-authorization check which can fail and return "card declined" errors. This is a **verification failure**, not a charge failure.

**Current behavior:**
- Error message: "Your card was declined"
- User perception: "Why was my card charged?"

**Expected behavior:**
- Error message: "Card verification failed. No charge was made..."
- User perception: "My card couldn't be verified, I'll try another card"

---

## Solution

### 1. Create Error Message Helper Function

Add a utility function to translate Stripe SetupIntent errors into user-friendly messages:

```typescript
function formatSetupError(error: { code?: string; message?: string }): string {
  // Map common Stripe decline codes to user-friendly messages
  const declineCodes = [
    'card_declined',
    'insufficient_funds',
    'lost_card',
    'stolen_card',
    'expired_card',
    'incorrect_cvc',
    'processing_error',
  ];

  if (error.code && declineCodes.includes(error.code)) {
    return `Card verification failed. No charge was made. Please check your card details or try a different card. (${error.code})`;
  }

  // Check if the message contains "declined" and reword it
  if (error.message?.toLowerCase().includes('declined')) {
    return "Card verification failed. No charge was made. The card issuer declined the verification request. Please try a different card or contact your bank.";
  }

  return error.message || "Failed to save card. Please try again.";
}
```

### 2. Update AdminAddCardForm.tsx

Modify the error handler to use friendly messaging:

```typescript
if (error) {
  console.error("Card setup error:", error);
  
  // Translate declined messages to clarify no charge was made
  let userMessage = error.message || "Failed to save card";
  if (error.message?.toLowerCase().includes('declined') || error.code === 'card_declined') {
    userMessage = "Card verification failed. No charge was made. Please check your card details or try a different card.";
  }
  
  toast.error(userMessage);
  setIsSubmitting(false);
  return;
}
```

### 3. Update AddApplicantCardModal.tsx

Apply the same error handling pattern:

```typescript
if (error) {
  // Translate declined messages to clarify no charge was made
  let userMessage = error.message || "Failed to save card";
  if (error.message?.toLowerCase().includes('declined') || error.code === 'card_declined') {
    userMessage = "Card verification failed. No charge was made. Please check your card details or try a different card.";
  }
  
  toast.error(userMessage);
  setIsSubmitting(false);
  return;
}
```

### 4. Update Other Card-Save Components

Apply the same fix to:
- `src/components/member/AddCardModal.tsx`
- `src/components/PaymentSectionEnhanced.tsx`
- `src/components/member/ApplicationUnderReview.tsx`

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/admin/AdminAddCardForm.tsx` | Improve error message for declined cards |
| `src/components/admin/AddApplicantCardModal.tsx` | Improve error message for declined cards |
| `src/components/member/AddCardModal.tsx` | Improve error message for declined cards |
| `src/components/PaymentSectionEnhanced.tsx` | Improve error message for declined cards |
| `src/components/member/ApplicationUnderReview.tsx` | Improve error message for declined cards |

---

## Expected Results

| Scenario | Before | After |
|----------|--------|-------|
| Card declined during save | "Your card was declined" | "Card verification failed. No charge was made. Please check your card details or try a different card." |
| Card expired | "Your card has expired" | "Card verification failed. No charge was made. Your card has expired. Please use a different card." |
| Other verification errors | Raw Stripe message | Friendly message with clarification that no charge was made |

