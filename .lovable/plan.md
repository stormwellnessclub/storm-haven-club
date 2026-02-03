
# Fix: Annual Fee Payment Link - Stripe Mode Error

## Problem
The edge function is failing with:
> "You specified `payment` mode but passed a recurring price. Either switch to `subscription` mode or use only one-time prices."

The annual fee prices in Stripe are configured as **recurring yearly prices**, but the code uses `mode: 'payment'` which only works with one-time prices.

## Root Cause
In `supabase/functions/stripe-payment/index.ts` at line 2571:
```typescript
mode: 'payment',  // Only works with one-time prices
```

But the annual fee price IDs are recurring yearly prices:
- Women: `price_1SlA2BLyZrsSqLhs8VX17F0C` ($300/year - recurring)
- Men: `price_1SlA2RLyZrsSqLhsK3XQuANN` ($175/year - recurring)

## Solution
Change `mode: 'payment'` to `mode: 'subscription'` since the annual fee is meant to renew yearly.

## Changes Required

| File | Change |
|------|--------|
| `supabase/functions/stripe-payment/index.ts` | Change `mode: 'payment'` to `mode: 'subscription'` in the `create_annual_fee_payment_link` action |

## Updated Code

```typescript
// Line ~2567-2582 in stripe-payment/index.ts
const linkSession = await stripe.checkout.sessions.create({
  customer: feeCustomerId,
  line_items: [{ price: feePriceId, quantity: 1 }],
  mode: 'subscription',  // Changed from 'payment' - annual fee is a yearly subscription
  success_url: feeSuccessUrl || 'https://storm-haven-club.lovable.app/payment-success?type=annual_fee',
  cancel_url: feeCancelUrl || 'https://storm-haven-club.lovable.app/',
  subscription_data: {
    metadata: {
      type: 'annual_fee_payment_link',
      application_id: applicationId,
      source: 'admin_generated_link',
    },
  },
  metadata: {
    type: 'annual_fee_payment_link',
    application_id: applicationId,
    source: 'admin_generated_link',
  },
});
```

## What This Means for Applicants
- Applicant clicks the payment link
- Completes payment on Stripe Checkout
- A yearly subscription is created that will auto-renew annually
- The webhook updates their application status to "paid"
- Card is saved for future renewals

## Webhook Update
Also need to update the webhook handler to expect a **subscription** instead of a **payment_intent** when processing `annual_fee_payment_link` type checkouts.

## Alternative Option
If you prefer the annual fee to be a one-time charge (not auto-renewing), you would need to create new one-time prices in Stripe Dashboard for $300 and $175 and use those instead. Let me know if you'd prefer that approach.
