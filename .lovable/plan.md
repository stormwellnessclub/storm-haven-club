## Cafe page refinement

Two targeted fixes on the public `/cafe` page. Nothing about Storm Shop, admin menu manager, or POS changes — items stay where they live in the database; we only stop leaking them into the public cafe UI and clean up the image presentation.

### 1. Stop shop items from appearing on /cafe

**Problem:** `useCafeMenuItems()` returns every active item with no section filter. The category chips on /cafe correctly show only cafe categories, but as soon as the page loads (no chip selected) `filteredItems = menuItems` renders *all* items — so Supplements, KITSCH, ZUMA, Socks, and Grip Socks bleed into the cafe grid.

**Fix:** In `src/components/cafe/CafeOrderContent.tsx`, derive a set of cafe-section category IDs from the already-loaded `categories` (which is scoped via `useCafeMenuCategories('cafe')`), and filter `menuItems` against that set before applying the selected-category filter.

```ts
const cafeCategoryIds = new Set(categories.map(c => c.id));
const cafeItems = menuItems.filter(i => i.category_id && cafeCategoryIds.has(i.category_id));
const filteredItems = selectedCategoryId
  ? cafeItems.filter(i => i.category_id === selectedCategoryId)
  : cafeItems;
```

No DB migration, no recategorization. Shop items continue to live under their shop categories and render on the Storm Shop page as today.

### 2. Align product imagery by category

**Problem:** Photos are a mix of packaged goods (cans, bottles, tubs) and prepared food (bowls, smoothies, bites). The current `h-48 object-cover` crops cans awkwardly and makes the grid look uneven.

**Fix (still in `CafeOrderContent.tsx`, item card image block):** Switch to a uniform `aspect-[4/3]` frame and pick `object-contain` vs `object-cover` per category so each card has the same outer footprint but the photo is rendered appropriately.

```text
┌─────────────────┐   ┌─────────────────┐
│   [whole can]   │   │   plated bowl   │
│  contain, bg    │   │  cover, edge    │
└─────────────────┘   └─────────────────┘
   Energy Drink           Açaí Bowl
```

- **Contain (packaged goods, full product visible, subtle muted bg):** Energy Drinks, Water, Refreshers, Shots, Preworkout, Coffee and Lattes when the photo is a branded can/bottle.
- **Cover (prepared food, edge-to-edge crop):** Smoothies, Protein Smoothie, Amino Acid Slushie, Cafe Bites, Toast, Fruit Cups, Cold Pressed Juice.

Implementation: a small lookup keyed by the category name (resolved via `categories.find(c => c.id === item.category_id)?.name`) returns `"contain"` or `"cover"`. Default to `cover` for anything unmapped. The dark gradient overlay stays only on `cover` cards (it would dirty a clean product shot on `contain`). Contain cards use `bg-secondary/40` behind the image so the framing reads intentional.

Both fixes also remove the gradient overlay on `contain` cards so packaged-product photos don't get darkened at the bottom.

### Out of scope
- No changes to Storm Shop, POS, admin menu manager, payment dialog, FAQs, SEO, or JSON-LD.
- No category renaming or moving items between sections in the DB.
- Mobile/desktop responsive behavior of the existing grid stays as-is.

### Files touched
- `src/components/cafe/CafeOrderContent.tsx` — filter cafe-section items, category-aware image framing.
