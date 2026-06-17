# SEO Optimization — Full Pass (Data-Driven)

Fix all 6 audit findings using H1s, meta titles, descriptions, and alt text grounded in real Semrush search data for your Livonia/Detroit market — not generic marketing words.

---

## Keyword strategy (from Semrush, US database)

| Page | Primary keyword | Volume | Current rank | Secondary keywords |
|---|---|---|---|---|
| Home | wellness club | 1,900/mo | #5 | fitness center livonia mi (140), storm fitness (480) |
| Spa | massage livonia mi | 390/mo | unranked | spa livonia mi (40), recovery spa |
| Amenities | livonia sauna | 140/mo | #26 | infrared sauna livonia, salt room livonia (20) |
| Personal Training | personal trainer livonia | 10/mo | — | private pilates livonia, reformer pilates livonia |

Reasoning: every phrase below is one Semrush confirms people actually type in this market. No invented or "feels right" language.

---

## 1. Sitemap — add missing routes

Edit `scripts/generate-sitemap.ts`:
- **Add:** `/personal-training`, `/personal-training/one-on-one`, `/personal-training/private-pilates`
- **Skip with comment:** `/mothers-day/success` and `/mothers-day-pack-redeem` — transactional/utility pages should not be indexed (standard SEO practice). Comment in the file prevents the scanner from re-flagging.

## 2. H1 headings — descriptive, visible, keyword-anchored

Visible page heading at the top of each page. Brand slogans stay as styled taglines above/below so hero designs are preserved.

| Page | New visible H1 | Tagline placement |
|---|---|---|
| `src/pages/Index.tsx` | **Wellness Club & Fitness Center in Livonia, MI** | Current slogan → small caps above H1 |
| `src/pages/Spa.tsx` | **Aella Recovery Spa — Massage & Recovery in Livonia** | Current slogan → subheading below H1 |
| `src/pages/Amenities.tsx` | **Storm Wellness Club Amenities — Sauna, Salt Room & More** | Current slogan → subheading |
| `src/pages/personal-training/Overview.tsx` | **Personal Training & Private Pilates in Livonia** | Current slogan → subheading |

## 3. Meta titles — under 60 chars, lead with keyword

| File | New `<Helmet>` title |
|---|---|
| `src/pages/Index.tsx` | `Wellness Club in Livonia, MI \| Storm Wellness Club` |
| `src/pages/Spa.tsx` | `Massage & Recovery Spa in Livonia \| Aella at Storm` |
| `src/pages/Amenities.tsx` | `Sauna, Salt Room & Amenities in Livonia \| Storm` |
| `src/pages/Cafe.tsx` | `The Café at Storm — Healthy Eats in Livonia, MI` |
| `src/pages/MothersDay.tsx` | `Mother's Day Spa Package — Storm Wellness Club` |
| `src/pages/personal-training/Overview.tsx` | `Personal Trainer in Livonia \| Storm Wellness Club` |

Every title <60 chars, lead with the keyword (Google weights first words higher), brand last.

## 4. Meta descriptions — rewrite for click-through

| Page | New description (under 160 chars) |
|---|---|
| Home | `Storm Wellness Club is Livonia's premier wellness club & fitness center — Pilates, cycling, recovery spa, sauna, and family memberships.` |
| Spa | `Massage, red light therapy, cold plunge & infrared sauna at Aella Recovery Spa in Livonia, MI. Book recovery treatments today.` |
| Amenities | `Sauna, salt room, cold plunge, café, and recovery amenities at Storm Wellness Club in Livonia, MI.` |
| Cafe | `Healthy café in Livonia, MI — protein bowls, smoothies, coffee. Open to the public at Storm Wellness Club.` |
| Personal Training | `1-on-1 personal training and private Pilates sessions in Livonia, MI. Certified trainers at Storm Wellness Club.` |

## 5. Alt text — descriptive + keyword where natural

In `src/pages/Index.tsx` (community banner, line 204):
- Current: 2-word generic
- New: `"Storm Wellness Club members training together in our Livonia fitness studio"`

Sweep all hero/banner images on Home, Spa, Amenities, Personal Training. Rule applied: describe what's literally in the image + add location/service when natural. Never keyword-stuff (Google penalizes that).

## 6. Performance — fix homepage LCP

In `src/components/home/Hero.tsx` for the lobby-hero image:
- Set explicit `width` and `height`
- Remove `loading="lazy"` if present
- Add `fetchpriority="high"`
- Add `<link rel="preload" as="image" href="/lobby-hero.jpeg" fetchpriority="high">` to `index.html`

Add `font-display: swap` to any `@font-face` rules in `src/index.css`.

## 7. Accessibility contrast

Sweep for `text-gray-300/400`, `text-muted-foreground/50` and similar low-opacity classes on light backgrounds; swap to `text-muted-foreground` / `text-foreground` design tokens.

## 8. Google Search Console — connect & verify

1. Trigger GSC connector — you OAuth into Google
2. Add META verification tag to `index.html`; you publish
3. I call Google to verify ownership and submit `https://stormwellnessclub.com/sitemap.xml`

After verification: real search impressions, click data, and indexing status flow into the Lovable SEO tab.

---

## Important: publishing required for 2 fixes

Findings #6 (performance) and #7 (contrast) are measured against the **last published site**. They'll only clear after you publish. The other findings clear on source change.

## Out of scope (separate efforts if you want)

- New dedicated landing pages for `/massage-livonia`, `/sauna-livonia` (would unlock the easy KDI 6-14 wins more aggressively)
- Google Business Profile optimization (where "near me" searches actually convert)
- Blog/content marketing for long-tail terms
- Schema markup beyond existing Organization

## Execution order

Steps 1-7 in one batch of file edits, then step 8 (GSC) as the final action since it needs your OAuth click.
