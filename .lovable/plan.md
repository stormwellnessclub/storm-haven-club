Going with the **v1 calm editorial** mockup — most refined of the three, closest to the v3 aesthetic you originally picked, and it executes the agreed 4-tab layout cleanly.

## Scope

Rebuild the **member, portal, and public** cafe ordering surface (`CafeOrderContent`) so all three routes inherit the new look. Admin POS, kiosk, and menu manager are untouched.

## Layout (agreed structure, dressed in v1)

**Desktop**
```text
┌────────────────────────────────────────────────────────────┐
│ STORM CAFÉ · Est. 2024 · Livonia MI       MENU · BAG (n)   │  ← slim header
├────────────────────────────────────────────────────────────┤
│  COFFEE BAR · SMOOTHIES & JUICE · ENERGY · EAT             │  ← intent tabs
├──────────────┬─────────────────────────────┬───────────────┤
│  Sub-rail    │  Items grid (2 cols)        │  Your Bag     │
│  (240px)     │  001 Latte 16oz   $8        │  (320px       │
│  · Coffee    │  002 Latte 20oz   $9        │   sticky)     │
│  · Matcha    │  003 Matcha 16oz  $9        │  Subtotal     │
│              │  ...                        │  MI Tax 6%    │
│              │                             │  [Checkout]   │
└──────────────┴─────────────────────────────┴───────────────┘
```

**Mobile**: horizontal scroll of 4 intent tabs → sub-category pills → single-column item cards → sticky bottom bar ("3 items · $35.00 · View bag"). Tapping View bag opens a sheet with the same cart content.

## Tab → DB category mapping (real, nothing invented)

- **Coffee Bar** → Coffee and Lattes
- **Smoothies & Juice** → Smoothies · Cold Pressed Juice
- **Energy & Hydration** → Energy Drinks · Protein Smoothie · Amino Acid Slushie · Refreshers · Water
- **Eat** → Cafe Bites

No "All" tab.

## Item card spec

- Numbered index (001, 002…) in mono caps
- "Coming soon" warm-stone placeholder (no AI food photography, ever)
- Item name in Bodoni serif caps
- Mono meta line: `Coffee / 16 oz`
- Italic serif price
- Terracotta **Add to Order** button (visible — not hidden behind a click)
- "Details" link → opens existing `CafeAddonDialog` with description, add-ons, nutrition (unchanged)

## Wordmark

`STORM CAFÉ` in Bodoni Moda, terracotta, ~28 px, single line in the header — paired with thin divider + `Est. 2024 · Livonia MI` in mono caps. Not a billboard.

## What does NOT change

- DB schema, categories, items, add-ons, nutrition fields
- `useCafeMenu`, `useCafeOrder` hooks
- `CafeAddonDialog` (description / add-ons / nutrition all preserved)
- Cart logic, checkout, Stripe
- Admin POS, kiosk, menu manager

## Files I'll touch

- `src/components/cafe/CafeOrderContent.tsx` — rebuild presentation: header wordmark, 4 intent tabs, left sub-rail, 2-col items grid, sticky right cart on desktop; sticky bottom bar on mobile. Map DB categories → 4 buckets.
- `src/index.css` — add Bodoni Moda + Space Mono via Google Fonts; add HSL tokens `--cafe-cream`, `--cafe-stone`, `--cafe-terracotta`, `--cafe-burgundy`.
- `tailwind.config.ts` — expose those tokens as `cafe-cream`, `cafe-stone`, `cafe-terracotta`, `cafe-burgundy` and font families `font-cafe-serif`, `font-cafe-mono`.

No new images. No new routes. No DB migrations. No business-logic changes.
