

## Problem

The Storm Shop page (`/shop`) on line 59 of `src/pages/Merch.tsx` filters products to only show those with `allow_preorder = true`:

```js
const categories = [...new Set(products?.filter((p) => p.allow_preorder).map((p) => p.category) || [])];
```

This means any product where `allow_preorder` is `false` is completely hidden from the storefront — even if it has inventory and is active. Members visiting from the portal see an empty or partial store.

## Fix

**1. Show all active products, not just preorder ones**
- Remove the `allow_preorder` filter from the categories list and from the product grid rendering
- All active products (already filtered by `useMerchProducts(true)`) will appear
- Products with stock get "Add to Cart" → paid checkout flow (already works)
- Products with `allow_preorder = true` but no stock get the preorder flow (already works)

**2. Smart stock-aware behavior on the product detail view**
- If a product has inventory in stock → show "Add to Cart" (buy now, charged immediately)
- If a product has zero stock but `allow_preorder = true` → show "Pre-order" button
- If zero stock and no preorder → show "Out of Stock" disabled state

**3. No database changes needed** — the `merch_products` table already has `is_active` and `allow_preorder` fields, and inventory is tracked in `merch_inventory`.

This is a one-file fix in `src/pages/Merch.tsx`, primarily removing the `allow_preorder` filter and adding stock-aware button labels.

