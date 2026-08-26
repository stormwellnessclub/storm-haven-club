# Fix the Aella logo box on the Spa page

## What's wrong

The Aella logo in the Spa page hero is `src/assets/aella-logo.png`, which is a flat image with **no transparency** — its background is a light grey/off-white (RGB 232,231,232). Because the hero behind it is a dark charcoal-overlaid photo, that light rectangle shows as a visible box around the logo.

The file named `aella-logo-transparent.png` is not actually transparent either (also flat RGB with a light background), so simply swapping files won't fix it.

## Fix

1. Produce a genuinely transparent version of the Aella mark from the existing logo art (background removal), saved as a new asset, e.g. `src/assets/aella-logo-mark.png`.
2. Confirm the mark reads correctly on the dark hero. If the artwork is dark ink on white, generate a light/gold-toned transparent version so it stays legible against the charcoal background.
3. Point the Spa hero at the new asset in `src/pages/Spa.tsx` (line ~356), keeping the same size (`h-24 w-auto`) and alt text.
4. Visually verify the hero in the preview with a screenshot — no box, logo legible.

## Fallback if the logo can't be cleaned up

If background removal leaves visible artifacts or the mark becomes unreadable on the dark hero, remove the image from the Spa hero entirely and replace it with a styled "Aella" wordmark in the site's serif/gold typography, keeping the existing "by Storm Wellness Club" line underneath.

## Also worth doing (say if you'd rather skip)

`src/pages/MothersDay.tsx` imports the same logo asset. I'll check whether it sits on a light or dark background there and update it only if the same box problem shows.

## Technical notes

- Files touched: new asset in `src/assets/`, `src/pages/Spa.tsx`, possibly `src/pages/MothersDay.tsx`.
- No layout, copy, or SEO changes — image asset and `src` only.
