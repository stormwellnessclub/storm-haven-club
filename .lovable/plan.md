

## Update Other Classes Member 10-Pack Price to $150

The member 10-pack for "Other Classes" is currently set to $180 but should be $150.

### Changes Required

**1. `src/pages/ClassPasses.tsx`**
- Update `otherClassesPricing` array: change the member 10-pack price from `180` to `150`

**2. `src/lib/stripeProducts.ts`**
- The existing Stripe price ID for the member 10-pack (`price_1T2Xo0LyZrsSqLhsJrhfsW8w`) was created at $180. A new Stripe price will need to be created at $150 and the ID replaced here.

**3. `supabase/functions/stripe-payment/index.ts`**
- Update the corresponding price ID to match the new $150 Stripe price

**4. `src/components/admin/SellClassPackage.tsx`**
- Update the `getPriceEstimate()` function: change the aerobics member 10-pack price from `180` to `150`

### Summary

| Package | Current | Updated |
|---------|---------|---------|
| Other Classes Member 10-Pack | $180 | $150 |

All other prices remain unchanged. A new Stripe price product will be created at $150 to replace the current $180 one.

