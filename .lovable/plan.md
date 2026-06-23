
## Goal
Stop truncating cafe item descriptions awkwardly on the card. Show a short teaser on the card, and let the user tap the item to open a detail view with the full description and nutrition info.

## Changes (frontend only, `src/components/cafe/CafeOrderContent.tsx`)

1. **Card display**
   - Replace the current multi-line clamped description with a single-line teaser (`line-clamp-1`, muted).
   - Append a subtle "Tap for details" affordance (small chevron / "More" link) so users know it expands.
   - Whole card becomes tappable to open the detail sheet (buttons inside — Add to Order / Customize — stop propagation so they still work independently).

2. **Detail view (new)**
   - Reuse the existing `Dialog` component (mobile = bottom sheet, desktop = centered modal — already built into our `DialogContent`).
   - Contents: item image (if any), full name, price, full description (no clamp), nutrition facts, allergens/tags, and the same Add to Order / Customize actions at the bottom so the user can act without closing.
   - Opens on card tap; close via existing dialog close.

3. **State**
   - Add `detailItem` state alongside the existing `addonDialogItem`.
   - No data fetching changes — uses fields already on the menu item.

## Out of scope
- No DB changes, no pricing/cart logic changes, no changes to the Smoothies/Functional Smoothie/Protein Smoothie tab grouping done previously.

## Technical notes
- Single file edit: `src/components/cafe/CafeOrderContent.tsx`.
- Use existing `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` from `@/components/ui/dialog`.
- Stop event propagation on the Add to Order / Customize buttons so card-tap doesn't conflict.
