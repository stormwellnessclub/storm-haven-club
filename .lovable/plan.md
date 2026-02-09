
# Plan: Add Gender Field to Guest Pass with Hard Server-Side Block

## Overview
This plan implements a **server-side gender validation** that blocks male guests from purchasing guest passes. The block happens in the edge function, making it impossible to bypass. The error message will direct guests to email the business instead of suggesting alternative dates.

---

## Implementation Strategy

### 1. Frontend Changes: `src/pages/GuestPass.tsx`
- Add `guestGender` state (type: `'male' | 'female' | ''`)
- Add radio button selector in the Guest Information card after phone number
- Update form validation to require gender selection
- Update disabled button state to include gender check
- Pass `guestGender` to the edge function in the API call body

### 2. Backend Changes: `supabase/functions/stripe-payment/index.ts`
- Add `guestGender?: 'male' | 'female'` to `PaymentRequest` interface
- In the `create_guest_pass_experience_checkout` case (line 540):
  - Add `guestGender` to destructured variables
  - Add validation check: if `guestGender === 'male'`, throw error with the contact email
  - Error message: *"We're sorry, guest passes are currently at capacity. Please email us at info@stormwellnessclub.com for more information."*

---

## User Experience Flow

| Step | Gender | Outcome |
|------|--------|---------|
| 1. User fills form | Female | Proceeds to Stripe checkout normally |
| 1. User fills form | Male | Form looks normal, no indication of restriction |
| 2. User clicks "Complete Guest Pass" | Male | Server returns error message after processing (appears as capacity limit) |
| 2. User clicks "Complete Guest Pass" | Female | Redirects to Stripe checkout |

---

## Error Message
> "We're sorry, guest passes are currently at capacity. Please email us at info@stormwellnessclub.com for more information."

This message:
- Appears natural (capacity limits are already mentioned on the page)
- Provides a direct contact method
- Does not reveal the actual restriction
- Matches existing UI patterns (toast notification)

---

## Code Changes

### Frontend: Gender Selection UI
The radio buttons will appear in the Guest Information card:
```
Sex *
○ Female    ○ Male
```

### Backend: Validation Logic
In `stripe-payment/index.ts` at line 554 (after validating required fields):
```typescript
if (guestGender === 'male') {
  logStep("Guest pass capacity check failed", { guestGender, guestName });
  throw new Error("We're sorry, guest passes are currently at capacity. Please email us at info@stormwellnessclub.com for more information.");
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/GuestPass.tsx` | Add gender state, radio buttons, API payload, validation |
| `supabase/functions/stripe-payment/index.ts` | Add gender to interface, server-side validation |

---

## Security
This block happens entirely on the server before Stripe is contacted. It cannot be bypassed by:
- Browser dev tools manipulation
- Direct API calls with modified gender
- Network inspection
- Frontend code modifications

The validation occurs in the edge function and affects the checkout before any Stripe operations begin.

---

## Files Modified
- `src/pages/GuestPass.tsx`
- `supabase/functions/stripe-payment/index.ts`
