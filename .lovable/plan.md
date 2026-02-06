
# Fix: Application Portal Payment Method Not Working

## Problem Identified
The `ApplicationUnderReview` component (used by applicants to add payment info from their self-service portal) is calling the `create_application_setup` edge function action **without** the required `successUrl` and `cancelUrl` parameters.

The edge function has a strict validation:
```typescript
if (!applicantEmail || !applicantName || !successUrl || !cancelUrl) {
  throw new Error("Missing required fields for application setup");
}
```

This causes the edge function to throw an error immediately, preventing the payment form from loading.

## Solution
Make `successUrl` and `cancelUrl` optional in the edge function for the embedded PaymentElement flow used by applicants. These URLs are only needed for redirect-based Checkout Sessions, not for the embedded SetupIntent flow.

---

## File Changes

| File | Change |
|------|--------|
| `supabase/functions/stripe-payment/index.ts` | Make `successUrl` and `cancelUrl` optional for `create_application_setup` action |

---

## Implementation Details

### Edge Function Update

**Current code (lines 141-152):**
```typescript
if (action === 'create_application_setup') {
  const { applicantEmail, applicantName, successUrl, cancelUrl } = body;

  if (!applicantEmail || !applicantName || !successUrl || !cancelUrl) {
    throw new Error("Missing required fields for application setup");
  }
  // ...
}
```

**Updated code:**
```typescript
if (action === 'create_application_setup') {
  const { applicantEmail, applicantName } = body;

  if (!applicantEmail || !applicantName) {
    throw new Error("Missing required fields for application setup (email, name)");
  }
  // Note: successUrl and cancelUrl are optional - only used by admin portal
  // The self-service flow uses embedded PaymentElement which doesn't redirect
  // ...
}
```

The rest of the function logic remains unchanged - it still creates the Stripe customer and SetupIntent correctly.

---

## Why This Happens

| Caller | Parameters Passed | Works? |
|--------|-------------------|--------|
| Admin Portal (`AddApplicantCardModal`) | email, name, successUrl, cancelUrl | ✅ Yes |
| Applicant Self-Service (`ApplicationUnderReview`) | email, name only | ❌ Fails validation |

The admin portal passes all 4 parameters because it was originally designed for redirect-based flows. The self-service applicant portal uses an embedded PaymentElement which handles everything inline without redirects, so those URLs aren't needed.

---

## Testing Steps
After the fix:
1. Log in as an applicant with a pending application
2. Navigate to the application status page
3. Click "Add Payment Method"
4. Verify the Stripe PaymentElement loads
5. Complete the card setup and confirm it saves successfully
