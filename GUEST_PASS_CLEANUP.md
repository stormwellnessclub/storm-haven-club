# Guest Pass Cleanup Summary

## Current Status ✅

**Single $60 Guest Pass Option:**
- ✅ `src/pages/admin/GuestPasses.tsx`: `const GUEST_PASS_PRICE = 60;`
- ✅ Only one price constant - no multiple options
- ✅ Clean implementation with single $60 option

**Placeholders for Stripe Price ID:**
- ⚠️ `src/lib/stripeProducts.ts`: `guestPass: 'TODO_ADD_STRIPE_PRICE_ID'`
- ⚠️ `supabase/functions/stripe-payment/index.ts`: `guestPass: 'TODO_ADD_STRIPE_PRICE_ID'` (duplicate)

## Notes

The `TODO_ADD_STRIPE_PRICE_ID` placeholders are **not price options** - they're placeholders for the Stripe Price ID that needs to be added when you create the price in Stripe Dashboard.

Once you create a $60 one-time payment price in Stripe, you'll need to replace `TODO_ADD_STRIPE_PRICE_ID` with the actual price ID (e.g., `price_1ABC...`).

## Verification

✅ **Only one guest pass option exists: $60**
✅ **No multiple price tiers or options found**
✅ **Structure is clean and correct**
