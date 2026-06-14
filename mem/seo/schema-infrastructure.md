---
name: SEO Schema Infrastructure
description: Centralized JSON-LD schema builders and business NAP data for Storm Wellness Club
type: feature
---
Sitewide Organization + HealthClub/LocalBusiness + WebSite JSON-LD lives in `index.html` as a single `@graph` block. The React-side equivalent lives in `src/lib/seo/business.ts` (NAP data — single source of truth: phone, hours, address, geo, socials, payment methods, area served) and `src/lib/seo/schemas.ts` (builder functions: `buildOrganizationLd`, `buildLocalBusinessLd`, `buildWebSiteLd`, `buildBreadcrumbLd`, `buildFAQLd`, `buildServiceLd`, `buildProductLd`, `buildEventLd`, `buildArticleLd`, `buildMenuLd`, `buildAggregateRatingLd`, `buildHowToLd`).

Per-page schemas inject via the upgraded `SEOHead` component's `jsonLd` prop (accepts single object or array). `SEOHead` now also supports `image`, `imageAlt`, `noindex` props and emits full og: + twitter: + dimensions tags.

When phone/hours/address change: edit `src/lib/seo/business.ts` AND `index.html` (static HTML is not regenerated from the TS module).
