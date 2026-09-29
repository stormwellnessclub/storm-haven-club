# Simpler website menu, combined pages, redesigned Storm Shop

## 1. Shorter, more premium menu
The top menu goes from 12 links to 7:

```text
Memberships · Classes · Spa · Events · Personal Training · Café · Shop
```

- **Classes** now includes class passes, on one page. The class schedule and class types come first, then a "Class Passes" section with the same purchase options as today.
- **Shop** is the Storm Shop and gift cards together.
- Gut Reset, Amenities and Guest Pass move out of the top bar into a small "More" group (and stay in the footer), so nothing disappears.
- Old addresses (/class-passes, /gift-cards) keep working. They open the new combined page, scrolled to the right section, so existing links, emails and Google results still work.

## 2. Storm Shop redesign (one page, three clear sections)
```text
[ Dark editorial header: "The Storm Shop" + short line ]
[ Section tabs:  Gift Cards  |  Apparel  |  Wellness & Skincare ]

GIFT CARDS (first, never buried)
  Large gift card feature: spa service gift or amount gift
  -> the current gift card purchase flow, unchanged (service choice,
     optional tip, recipient email and message, confirmation on the site)

APPAREL
  Refined product grid: smaller cards, consistent sizes, price, sizes
  Products without photos show an elegant typographic card
  (Storm mark, product name, color) instead of an empty box

WELLNESS & SKINCARE
  The existing retail items, restyled to match
```
- Same black, gold and cream look as the rest of the site. No stock or AI images.
- Checkout, cart, taxes and pickup work exactly as today.

## 3. Gift cards in the Spa
- Add a clear "Give a Spa Gift Card" panel on the Spa page and on each spa service page ("Gift this service"). Tapping it opens the gift card purchase with that service already picked.

## Needs from you
- None of the 5 apparel items has photos right now. Once you upload product photos in the admin shop manager, they'll appear on the redesigned product cards automatically.

## Technical details
- `Navigation.tsx` / `Footer.tsx`: new link list plus a "More" dropdown on desktop and mobile.
- `Classes` page embeds the pass-purchase content from `ClassPasses.tsx` (extracted into a component, section `#passes`). `/class-passes` redirects to `/classes#passes`.
- New `Shop` page composes the `GiftCardStore` content (extracted as a component, `#gift-cards`), a redesigned `Merch` grid, and `CafeOrderContent section="shop"`. `/gift-cards` redirects to `/shop#gift-cards`. Supports a `?service=` preselect.
- Spa and SpaServicePage link to `/shop?service=<id>#gift-cards`.
- No database or payment changes.
