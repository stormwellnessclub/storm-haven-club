# Add-ons missing on customer cafe orders

## Root cause

The public cafe page at `src/pages/Cafe.tsx` was never wired up to handle add-ons. It only fetches `useCafeMenuItems()` and `useCafeMenuCategories()` — it never calls `useCafeMenuAddons()`, and clicking an item drops it straight into the cart with no chance to pick milk, protein, syrups, etc.

Meanwhile the admin POS (`CafePOSMenu` / `CafePOSCart`) does fully support add-ons, so the data exists and works — it's only the public storefront that's missing the UI.

## What to build

1. **Fetch add-ons** in `src/pages/Cafe.tsx` via `useCafeMenuAddons()`, grouped by `category_id`.
2. **Item-tap behavior**: when a customer taps an item whose category has `has_addons = true` AND there are active add-ons for that category, open an "Customize your drink" dialog instead of adding immediately. If no add-ons apply, keep current one-tap-add behavior.
3. **Customization dialog** (new small component, e.g. `src/components/cafe/CafeAddonDialog.tsx`):
   - Lists add-ons for the item's category as toggleable chips/checkboxes with prices (e.g. "Oat milk +$1.00").
   - Shows a running total (item price + selected add-ons).
   - "Add to cart" button confirms.
4. **Cart model**: extend the cart item shape to carry `addons: { id, name, price }[]` and compute line total as `(price + sum(addons.price)) * quantity`. Include add-on names in the Stripe description and in the order record's items array so kitchen/staff see them. Two of the same drink with different add-ons should be separate cart lines (key by `item.id + sorted addon ids`).
5. **Cart UI**: show selected add-ons under each line item as a small muted list ("+ Oat milk, + Extra shot").
6. **Tax + processing fee** continue to apply to the new (item + add-ons) subtotal — no change to the formula.

## Out of scope

- Admin POS add-on flow (already works).
- No DB / RLS / edge function changes — `cafe_menu_addons` already returns active rows publicly via `useCafeMenuAddons`.
- No pricing or tax logic changes beyond using the new subtotal.

## Files touched

- `src/pages/Cafe.tsx` — fetch add-ons, open dialog, updated cart model + rendering, updated checkout payload.
- `src/components/cafe/CafeAddonDialog.tsx` — new.
