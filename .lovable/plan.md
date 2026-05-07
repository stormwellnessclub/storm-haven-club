## Problem

The Mother's Day Class Pack section overflows on multiple breakpoints:

- **Mobile (390px):** Member card's gift button "Buy as a gift for a Storm Wellness Club member" doesn't wrap (shadcn `Button` defaults to `whitespace-nowrap`), forcing the card wider than the viewport. The whole section shifts off-center — heading clips on the left, button clips on the right.
- **Laptop / desktop (≥768px, 2-col grid):** same long label stretches past the card's right edge inside the 2-column grid, breaking the card box visually.

## Fix (UI only — `src/components/marketing/MothersDayClassPackSection.tsx`)

1. **Allow the long button labels to wrap on every breakpoint:**
   - Both `Buy as a gift…` Buttons (Member + Non-Member cards): add `whitespace-normal h-auto py-2 leading-tight text-sm` and let the icon stay at the start. Keep `Gift` icon `flex-shrink-0`.
2. **Use a shorter label on mobile to avoid an awkward 3-line wrap, full label on ≥sm:**
   - Member card: `<span className="sm:hidden">Gift to a member</span><span className="hidden sm:inline">Buy as a gift for a Storm Wellness Club member</span>`
   - Non-Member card: leave `Buy as a gift` as-is (it's already short).
3. **Tighten card padding on mobile** so the cards visually match the rest of the page width:
   - Both `Card`s: `p-8` → `p-6 sm:p-8`.
4. **Guard the section against any future overflow:**
   - Outer `<section>`: add `overflow-hidden`.
   - Grid items: add `min-w-0` so a long string can never blow out the column.

No business logic, pricing, or backend changes. Copy change is mobile-only.

## Verification

Browser screenshot pass at:
- 390px (mobile) — both cards inside viewport, heading centered, gift button wraps to 2 clean lines.
- 1024px (laptop) — full "Buy as a gift for a Storm Wellness Club member" label wraps cleanly inside the Member card; both cards equal width, nothing protrudes.
- 1440px (desktop) — visually unchanged from current intent (label may fit on one line; if not, wraps cleanly).
