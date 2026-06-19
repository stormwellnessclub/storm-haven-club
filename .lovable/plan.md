## Nothing to move — they're already in Storm Shop

After checking the database, every non-food category you mentioned is **already** assigned to the `shop` section, not `cafe`:

| Category | Section | Items |
|---|---|---|
| Supplements | shop | 7 |
| KITSCH | shop | 15 |
| SOCKS | shop | 19 |
| ZUMA | shop | 5 |
| Grip Socks | shop | 1 |
| Apparel | shop | 0 |

The reason they *looked* like they were in the cafe before was a **frontend bug**: the `/cafe` page was loading every active menu item without filtering by section, so shop items leaked into the cafe grid. That bug was already fixed in the previous turn — `/cafe` now shows only `section='cafe'` items, and Storm Shop continues to show `section='shop'` items.

## What stays in Cafe (per your instruction)

Energy Drinks, Water, Refreshers, Shots, Preworkout, plus all prepared food/drink (Smoothies, Coffee & Lattes, Cafe Bites, Toast, Fruit Cups, Cold Pressed Juice, Protein Smoothie, Amino Acid Slushie).

## Proposed action

**None — no code or data changes needed.** If you're still seeing Supplements/KITSCH/Socks/ZUMA on the `/cafe` page, it's a stale cache. Hard-refresh (Cmd/Ctrl+Shift+R) and they'll be gone.

If instead you meant something different — e.g. you're seeing a *specific* item mislabeled, or you want me to verify the Storm Shop page is rendering all 47 shop items correctly — tell me which and I'll dig in.