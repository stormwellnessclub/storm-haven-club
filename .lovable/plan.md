

# Fix: Stop Absorbing Stripe Processing Fees on POS Orders

## Problem
You're absorbing Stripe's 2.9% + $0.30 processing fee on POS card charges because of two bugs:

1. **Front Desk POS** (`FrontDeskPOS.tsx`) — does NOT calculate or add any processing fee at all. The customer only pays subtotal + tax, and Stripe deducts its fee from your payout.

2. **Both POS terminals** send `customerId` to the edge function, but the `charge_saved_card` handler expects `stripeCustomerId`. This means the parameter is silently ignored and the charge may route incorrectly. The Café POS does calculate the fee but the field name mismatch is a latent bug.

## Fix

### 1. Front Desk POS — add processing fee (`src/pages/admin/FrontDeskPOS.tsx`)
- Import `calculateProcessingFeeFromDollars`
- Calculate processing fee for card-on-file charges (same logic Café POS already has)
- Add fee to the total charged and include it as an order line item

### 2. Fix field name in both POS charge calls
- **CafePOS.tsx line 77**: change `customerId` → `stripeCustomerId`
- **FrontDeskPOS.tsx line 75**: change `customerId` → `stripeCustomerId`

### 3. Add tax/subtotal metadata to POS charges
- Both POS files should send `taxAmount` and `subtotal` in the charge body (like ChargeItemSelector already does) for proper tax reporting

### Files changed
- `src/pages/admin/CafePOS.tsx` — fix field name, add metadata
- `src/pages/admin/FrontDeskPOS.tsx` — add processing fee calculation, fix field name, add metadata

