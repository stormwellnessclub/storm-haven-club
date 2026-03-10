

# Rename "Merch" to "Storm Shop" + Expand Categories & Custom Colors

## Problem
The current system is hardcoded to apparel-only categories (`Hoodies, T-Shirts, Hats, Accessories, Bottoms`) and only 4 fixed colors (`Black, White, Gray, Navy`). You need to sell shampoo, skincare, supplements, and other non-apparel items that may not have sizes or colors, plus allow custom color/category entry.

## Changes

### 1. Rename everything from "Merch" to "Storm Shop"
- **POS tabs** in `CafePOS.tsx` and `FrontDeskPOS.tsx`: label changes from "Merch" to "Storm Shop"
- **Admin sidebar** in `AdminSidebar.tsx`: "Merch Manager" → "Storm Shop Manager"
- **Admin page** `MerchManager.tsx`: title/description update
- **Public page** `Merch.tsx`: "Storm Haven Merch" → "Storm Shop" branding
- **Route**: keep `/merch` path but update display text (or optionally rename to `/shop`)
- **MerchPOSTab.tsx**: empty state text update

### 2. Expand categories to include non-apparel
Update `DEFAULT_CATEGORIES` in `MerchManager.tsx` to:
`["Apparel", "Hoodies", "T-Shirts", "Hats", "Bottoms", "Skincare", "Hair Care", "Supplements", "Wellness", "Accessories", "Other"]`

Also add a **custom category input** — a text field that lets you type a new category if none of the defaults fit.

### 3. Allow custom colors (not just 4 preset)
Replace the fixed 4-color toggle with:
- Keep the preset color buttons as quick-select
- Add expanded defaults: `Black, White, Gray, Navy, Red, Blue, Green, Pink, Purple, Tan, Brown, Camo, Olive`
- Add a **custom color text input** so you can type any color name and add it

### 4. Make sizes and colors optional
Non-apparel items (shampoo, supplements) don't need sizes or colors. Update the product form to:
- Allow saving with empty sizes array (already works in DB)
- Allow saving with empty colors array
- The POS tab and public store already handle empty arrays gracefully (conditional rendering)

### 5. Update public store branding
- `Merch.tsx` header: "Storm Shop" / "Branded gear, wellness products & more — preorder now"
- Empty state: "Check back for new product drops"

### Files to modify
1. `src/pages/admin/MerchManager.tsx` — expanded categories, custom color/category input, title rename
2. `src/components/admin/MerchPOSTab.tsx` — empty state text
3. `src/pages/admin/CafePOS.tsx` — tab label
4. `src/pages/admin/FrontDeskPOS.tsx` — tab label
5. `src/components/admin/AdminSidebar.tsx` — sidebar label
6. `src/pages/Merch.tsx` — public store branding
7. `src/App.tsx` — optionally add `/shop` as alias route

No database changes needed — the schema already supports flexible categories, sizes, and colors as text arrays.

