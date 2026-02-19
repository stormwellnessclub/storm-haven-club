
# Update Class Prices and Fix Temp Schedule Banner

## 1. Update "Other Classes" Pricing

The current `otherClassesPricing` in `ClassPasses.tsx` shows:
- Single Class: Member $15 / Non-Member $30
- 10 Class Pack: Member $150 / Non-Member $200

**Updated prices:**

| Package | Member Price | Non-Member Price |
|---------|-------------|-----------------|
| Single Class | $20 (was $15) | $30 (no change) |
| 10 Class Pack | $180 (was $150) | $180 (was $200) |

### File: `src/pages/ClassPasses.tsx`
- Line 30: Change memberPrice from `15` to `20`
- Line 31: Change memberPrice from `150` to `180`, nonMemberPrice from `200` to `180`

### File: `src/lib/stripeProducts.ts` and `supabase/functions/stripe-payment/index.ts`
- Create new Stripe prices for the updated amounts ($20 member single, $180 member 10-pack, $180 non-member 10-pack) and update the corresponding price IDs in both files
- The non-member single at $30 stays the same

### File: `src/components/admin/SellClassPackage.tsx`
- Update `getPriceEstimate()` to reflect the new member and non-member prices for "other" classes

## 2. Remove Instructor Name from Temp Schedule Banner

### File: `src/components/booking/TempClassSchedule.tsx`
- Line 141: Remove "Instructor: Duha" from the banner text. The instructor name already appears on each individual class card (line 75), which is where it belongs -- this way if the instructor changes, you only update the class card data, not the banner.
- Updated banner text: `"February 20 -- March 18, 2026 . All classes 50 min . Booking opens soon"`
