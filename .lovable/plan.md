# Real share images and metadata for key pages

## What's there today

Spa, Café, Schedule, Memberships, Events and ~25 other public pages already emit Open Graph and Twitter Card tags through the shared `SEOHead` component, so titles and descriptions are correct. Two things are wrong:

1. **Every page shares one image** — the square 512px app icon — and the tags falsely declare it as 1200x630. Shared links show a small, cropped logo instead of a real preview.
2. **Crawlers that don't run JavaScript** (Facebook, LinkedIn, Slack, iMessage, Twitter) see the `seo-prerender` copy, not the page copy. Its per-page titles and descriptions have drifted from the live pages (for example `/spa` still says "Recovery Spa" instead of the updated Aella wording), and it also hardcodes the same app icon as the image.
3. `/classes` is a redirect to `/schedule` and carries no metadata of its own.

## Plan

**1. Create 1200x630 share images**

Build one landscape share card per key page from existing photography, with the Storm wordmark and page name laid over a dark gradient:

- `public/og/og-default.jpg` — lobby hero, sitewide fallback
- `public/og/og-spa.jpg` — spa imagery, Aella branding
- `public/og/og-classes.jpg` — classes/reformer imagery (used for `/schedule` and `/classes`)
- `public/og/og-cafe.jpg` — café imagery
- `public/og/og-memberships.jpg` — memberships hero

**2. Wire them into the pages**

- Change `SEOHead`'s default image to `/og/og-default.jpg` so every page that doesn't specify one gets a proper landscape preview.
- Pass `image` and `imageAlt` on Spa, Café, Schedule, Memberships, Events and the spa category hub.

**3. Give `/classes` its own snippet**

Keep the redirect behaviour, but render metadata for the route so a shared `/classes` link previews correctly instead of falling back to the homepage tags.

**4. Sync the prerender output**

In `seo-prerender`, add a per-path `ogImage` alongside title/description, point each key path at its new card, and update the `/spa`, `/cafe`, `/schedule` and `/memberships` titles and descriptions to match the wording the live pages now use. Redeploy the function.

## Technical notes

- Images are generated at 1200x630 and saved as JPG under `public/og/`, so both the client tags and the prerender output reference the same absolute URLs on `stormwellnessclub.com`.
- No change to `SEOHead`'s API beyond the new default; existing `image` overrides keep working.
- Social platforms cache previews. After publishing, an already-shared link keeps its old preview until the platform re-scrapes; it can be forced through each platform's link debugger.
