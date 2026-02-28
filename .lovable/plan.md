
# Add Quantity Support to Charge POS Dialog

## Problem
The `ChargeItemSelector` component (the charge dialog used from member profiles and the Front Desk POS) only charges 1 unit at a time. There's no way to set a quantity, so if a member wants 3 waters, you'd have to charge them 3 separate times.

## Solution
Add a quantity selector (with +/- buttons) to the `ChargeItemSelector` dialog that multiplies the item price by the chosen quantity before charging.

## Changes

### File: `src/components/admin/ChargeItemSelector.tsx`

1. **Add quantity state** -- new `quantity` state variable, defaulting to 1, reset when item selection changes or dialog closes.

2. **Add quantity UI** -- After the item selector (and after the shake customization section if applicable), add a "Quantity" row with minus/plus buttons and a count display. Styled consistently with the rest of the dialog.

3. **Update amount calculations** -- Multiply `effectiveAmount` by `quantity` so the subtotal, tax, processing fee, and total all reflect the correct multi-item amount. The description will also note the quantity (e.g., "2x Cafe - Fiji Water").

4. **Update charge button** -- The charge button amount will reflect the quantity-adjusted total.

### What stays the same
- The Cafe POS page (`CafePOS.tsx` / `CafePOSCart.tsx`) already has its own cart with quantity controls -- no changes needed there.
- All backend charge logic stays the same since it already accepts any dollar amount and description.
