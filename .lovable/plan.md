

# Fix: Stop Absorbing Stripe Processing Fees on POS Orders

## Status: ✅ Implemented

## Summary
Fixed two POS terminals to stop absorbing Stripe processing fees (2.9% + $0.30) and corrected the `customerId` → `stripeCustomerId` field name mismatch.

## Changes Made
- `src/pages/admin/FrontDeskPOS.tsx` — added processing fee calculation, fixed field name, added tax/subtotal metadata
- `src/pages/admin/CafePOS.tsx` — fixed `customerId` → `stripeCustomerId`, added tax/subtotal metadata

## Previous: Unify Class Passes as "Class Pass" (✅ Done)
Merged two class pass categories into one "Class Pass" at the Pilates/Cycling price. Legacy passes honored with directional upgrade logic.
