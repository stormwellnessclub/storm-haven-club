

# Fix Sales Tax Report — Cents vs Dollars Bug

## Problem
The sales tax amounts are 100× too high. A $9 coffee shows as $900; $0.54 of tax shows as $54.

## Root Cause
The `stripe-payment` edge function stores `tax_amount` and `subtotal` in Stripe metadata **in cents** (e.g., `"54"` for $0.54). The `stripe-sales-tax` edge function reads these values with `parseFloat()` and treats them as **dollars** — never dividing by 100.

**Line 210** of `stripe-sales-tax/index.ts`:
```javascript
taxAmount = parseFloat(metadata.tax_amount) || 0;  // reads 54, treats as $54.00
```
**Line 216**:
```javascript
subtotal = parseFloat(metadata.subtotal) || subtotal;  // reads 900, treats as $900.00
```

## Fix
In `supabase/functions/stripe-sales-tax/index.ts`, divide both metadata values by 100 to convert cents → dollars:

```javascript
// Line ~210: metadata.tax_amount is in cents
taxAmount = (parseFloat(metadata.tax_amount) || 0) / 100;

// Line ~216: metadata.subtotal is in cents
subtotal = (parseFloat(metadata.subtotal) || 0) / 100;
```

One file changed, two lines. Everything else (invoice tax, description back-calculation) already handles cents→dollars correctly.

