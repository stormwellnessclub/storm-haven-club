

# Guest Pass Price ID Integration

## Summary
Update the Guest Pass feature with the Stripe Price ID `price_1SxATYLyZrsSqLhs6vDu1QWg` to enable $60 guest pass purchases.

## Changes Required

### 1. Update Frontend Stripe Products Config
**File:** `src/lib/stripeProducts.ts`

Update line 73 from:
```typescript
guestPass: 'TODO_ADD_STRIPE_PRICE_ID',
```
to:
```typescript
guestPass: 'price_1SxATYLyZrsSqLhs6vDu1QWg',
```

### 2. Update Edge Function Stripe Products
**File:** `supabase/functions/stripe-payment/index.ts`

Update the duplicate `guestPass` constant to match:
```typescript
guestPass: 'price_1SxATYLyZrsSqLhs6vDu1QWg',
```

## Result
After these updates:
- Guest pass purchases will work end-to-end
- Admin can create guest passes via `/admin/guest-passes`
- Stripe Checkout will process $60 one-time payments
- Webhooks will correctly handle guest pass creation

## Technical Details
- **Price ID:** `price_1SxATYLyZrsSqLhs6vDu1QWg`
- **Product ID:** `prod_Tv0UAygGuR9bAy`
- **Amount:** $60.00 USD (one-time payment)
- **Files affected:** 2 files

