# Guest Pass Price ID - Setup Instructions

## Current Status

**Placeholder:** `'TODO_ADD_STRIPE_PRICE_ID'` in code  
**Price:** $60 (one-time payment)  
**Feature:** Blocked until price ID is added

## What Needs to Be Done

### Step 1: Create Price in Stripe Dashboard

1. Go to: https://dashboard.stripe.com/products
2. Click "Add product" or find existing "Guest Pass" product
3. If product doesn't exist:
   - Name: "Guest Pass"
   - Description: "Gym and amenities access, subject to availability"
   - Price: $60.00 USD
   - Billing: One time
   - Click "Save product"
4. Copy the **Price ID** (starts with `price_`)

### Step 2: Update Code

Update the price ID in **TWO locations**:

**File 1: `src/lib/stripeProducts.ts`**
```typescript
// Line 73
guestPass: 'price_YOUR_ACTUAL_PRICE_ID_HERE',  // $60 - Guest Pass
```

**File 2: `supabase/functions/stripe-payment/index.ts`**
```typescript
// Line 58
guestPass: 'price_YOUR_ACTUAL_PRICE_ID_HERE',  // $60 - Guest Pass
```

### Step 3: Verify

1. Test guest pass purchase in admin portal
2. Verify checkout works correctly
3. Check Stripe Dashboard for successful payment

## Files to Update

1. `src/lib/stripeProducts.ts` (line 73)
2. `supabase/functions/stripe-payment/index.ts` (line 58)

## Important Notes

- **Both files must match** - They're duplicated due to Deno/Node.js separation
- **Price ID format:** `price_xxxxxxxxxxxxx` (starts with `price_`)
- **Price amount:** $60.00 USD (one-time payment)
- **After update:** Guest pass feature will be fully functional

## Quick Copy-Paste Template

Once you have the Stripe Price ID, replace in both files:

**Find:**
```typescript
guestPass: 'TODO_ADD_STRIPE_PRICE_ID',
```

**Replace with:**
```typescript
guestPass: 'price_YOUR_ACTUAL_PRICE_ID_HERE',
```

## Testing After Update

1. Go to `/admin/guest-passes`
2. Enter guest name and email
3. Click "Create Guest Pass"
4. Complete Stripe Checkout
5. Verify guest pass created in database
6. Verify payment in Stripe Dashboard
