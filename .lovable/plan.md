## Consolidate chia items into one card with a flavor picker

Merge the 6 chia pudding variants into a single menu tile. Clicking the tile opens a flavor picker showing each flavor (price, calories, image if any) with a per-flavor "View details" button (existing info/nutrition dialog) and an "Add to Order" button.

### Items being grouped (all Colostrum-based chia puddings)
- Chia Pudding With Colostrum — Raspberry Strawberry Unicorn Cream
- Colostrum & Saffron Chia — Pistachio Cream & Fig Jam
- Colostrum & Saffron Chia — Lavender Apricot Preserve & Crème
- Colostrum & Saffron Chia — PB&J
- Colostrum & Saffron Chia — Blackcurrant Pomegranate Hibiscus
- Colostrum Saffron Chia — Hazelnut Chocolate

**Not grouped** (separate products): Overnight Oats With Chia and Dates, Protein Yogurt With Chia Pudding.

### Implementation

1. **DB normalization** — update the 6 rows so they share `item_name = "Colostrum Chia Pudding"`. Their unique flavor stays in `flavor`. No data lost.

2. **Grouping logic in `CafeOrderContent.tsx`** — before rendering the items grid, group `visibleItems` by `item_name` within the same category. If a group has 2+ items, collapse it into one virtual "group card" (uses first item's image, name = shared item_name, price shown as `From $X` if flavors differ, otherwise flat price).

3. **Flavor picker dialog** — clicking a group card opens a new dialog listing each flavor as a row: flavor name, price, calories, "View details" (opens the existing `detailItem` dialog for that specific flavor), "Add to Order" button. Single-item "groups" render as normal cards (unchanged behavior).

4. **Existing per-flavor detail dialog stays as-is** — each flavor's full description/benefits/nutrition remain accessible.

No layout or styling changes beyond the new picker dialog (matched to existing cafe editorial style).