## Goal

Add a small Mother's Day **spa** sale banner to the public homepage, alongside the existing class-pass `PromoBanner`.

## Context

- `src/components/marketing/MothersDayBanner.tsx` already exists, dismissible, auto-hides after May 11, links to `/mothers-day` (Custom Massage + Wet Spa Access, 6-month redemption). It's not mounted anywhere on the public homepage.
- `src/pages/Index.tsx` line 102 currently renders `<PromoBanner />` (class-pass / Mother's Day class pack) just inside the `<Layout>`.

## Change (UI only — `src/pages/Index.tsx`)

1. Import `MothersDayBanner` from `@/components/marketing/MothersDayBanner`.
2. Wrap both banners in a slim container right under `<Layout>` so they sit stacked and centered, above the hero:

   ```tsx
   <PromoBanner />
   <div className="container mx-auto px-6 pt-4">
     <MothersDayBanner />
   </div>
   ```

   - `PromoBanner` keeps full-bleed at the very top.
   - `MothersDayBanner` (rounded card, gold gradient) sits inside the container so it visually matches the page rhythm and is clearly separate from the class-pass strip.
   - Component already self-hides past May 11 and after dismiss, so no extra logic needed.

No copy changes, no business logic changes, no backend changes.

## Verification

- Browser screenshot of `/` at 1366px and 390px to confirm:
  - Class-pass `PromoBanner` strip on top.
  - Mother's Day spa card below it, inside container, dismissible, "View Special" → `/mothers-day`.
  - No layout shift or overlap with hero.
