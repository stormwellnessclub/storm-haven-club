## Diagnosis (Semrush + code review)

**You rank for 83 keywords. Every one is gym/fitness/"wellness club".** Zero impressions for cafe, smoothie, protein shake, spa, recovery, red light, cryo, sauna, massage. Matches what you're seeing in GA. Two root causes:

### 1. `/cafe` has no crawlable SEO content
- `SEOHead` title/description are fine.
- But the visible H1 is *"Nourish From Within"* — brand poetry, zero keywords.
- The rest of the page (`CafeOrderContent`) is an interactive menu UI. Google sees an ordering app, not "smoothies, protein shakes, acai bowls in Livonia."
- No editorial copy, no menu category descriptions, no FAQ, no `Restaurant`/`FoodEstablishment` JSON-LD.

### 2. `/spa` subpages exist but target the wrong phrasing
- `RedLightTherapy.tsx`, `Cryotherapy.tsx`, `Massage.tsx` etc. are well structured (`ServiceLandingPage` with H1, body, benefits, FAQ, Service JSON-LD). Good bones.
- They all target **"X in Livonia, MI"**. Semrush shows that phrasing has ~0 search volume locally:
  - `red light therapy livonia` → no volume
  - `cryotherapy livonia` → no volume
  - `infrared sauna livonia` → no volume
- The real demand is **"X near me"** (Google resolves these to local results — geo signals + Livonia mentions in body still win them):
  - `red light therapy near me` → **22,200/mo**, difficulty 9 (very easy)
  - `cryotherapy near me` → **22,200/mo**, difficulty 38
  - `infrared sauna near me` → **14,800/mo**, difficulty 46
  - `cold plunge near me` → **14,800/mo**, difficulty 35
  - `massage livonia` → **260/mo**, difficulty 10 (already low-hanging)
  - `smoothie bar near me` → **2,400/mo**, difficulty 30
  - `protein shake near me` → **8,100/mo**, difficulty 36
- Combined with the fact these pages are recent and have no inbound links yet — Google hasn't decided they're authoritative for recovery terms.

### 3. Smaller issues
- `/spa` hub and subpages have no `BreadcrumbList` / `LocalBusiness` parent link in JSON-LD beyond what `ServiceLandingPage` already ships.
- No internal links from the homepage *body copy* (not just nav) to /cafe or to individual spa subpages — Google weighs in-content links higher than nav links.
- `Cafe.tsx` page is missing `Restaurant` + `Menu` schema entirely.

---

## Plan

### A. Rewrite `/cafe` as a real SEO landing page (`src/pages/Cafe.tsx`)
Keep `CafeOrderContent` for the ordering UI, but wrap it with a crawlable editorial section above it:
- **Title/meta**: change to *"Smoothie Bar, Protein Shakes & Açaí Bowls | Storm Café — Livonia, MI"* / refreshed description with the same terms.
- **H1**: replace "Nourish From Within" with *"Smoothie Bar, Protein Shakes & Açaí Bowls in Livonia, MI"*. Keep the brand line as the H2/subhead.
- **Editorial intro (2–3 paragraphs)** covering: smoothies & protein shakes (post-workout), açaí + pitaya bowls, cold-pressed juices, espresso, healthy snacks — written naturally with "near me / Livonia / Detroit metro" geo phrasing.
- **Menu category sections** (Smoothies / Protein Shakes / Açaí Bowls / Cold-Pressed Juice / Coffee & Espresso / Snacks): a short keyword-rich blurb per category, then the existing live menu UI underneath.
- **FAQ block** (4–5 Q&As): "Is the café open to non-members?", "What's in your protein shakes?", "Do you offer dairy-free / vegan options?", "Where can I get an açaí bowl near Livonia?" — also rendered as `FAQPage` JSON-LD.
- **JSON-LD**: add `Restaurant` (sub-type `CafeOrCoffeeShop`) with address, geo, opening hours, `servesCuisine`, `acceptsReservations: false`, and a `Menu` reference.

### B. Re-target the spa subpages for "near me" + Detroit metro intent
For each of the 8 spa subpages (`RedLightTherapy`, `Cryotherapy`, `InfraredSauna`, `ColdPlunge`, `SaunaSteam`, `Massage`, `SaltRoom`, `Zerobody`):
- **Title pattern**: *"Red Light Therapy Near Me | Livonia, MI — Storm Wellness Club"* (keeps brand, captures "near me" + city).
- **H1 unchanged structure** but tweaked: *"Red Light Therapy Near Livonia, MI"* — "near" signals locality without sounding spammy.
- **Add a "Serving the Detroit Metro" paragraph** to each `body[]` array naming Farmington Hills, Plymouth, Northville, Novi, Redford, Westland, Canton, Southfield — already in the SEO schema but not in the visible body. Google ranks on visible content.
- **Add 1–2 new FAQs per page targeting question-style queries** that show up in Semrush related/question keywords (I'll pull these per page during build): e.g. "How much does red light therapy cost near Livonia?", "Is cryotherapy safe?", "How often should I use an infrared sauna?".
- **Cross-link**: every spa subpage already has `related` — extend to also link `/cafe` ("refuel after recovery") and the relevant homepage anchor.

### C. Strengthen the `/spa` hub (`src/pages/Spa.tsx`)
- Tighten H1 to include "Recovery Spa & Wellness Spa in Livonia, MI".
- Add a short intro paragraph above the service grid mentioning all 8 modalities by name (currently the modalities are inside cards — Google reads them, but a synthesizing paragraph helps topical authority).
- Add `BreadcrumbList` JSON-LD (Home → Recovery Spa).

### D. Internal linking from the homepage
- In the existing Recovery and Cafe sections of the homepage body copy, link the **service names inline** (not just CTA buttons) to `/spa/red-light-therapy`, `/spa/cryotherapy`, `/spa/infrared-sauna`, `/cafe`. In-content links pass more SEO weight than nav links.

### E. Sitemap
- Already lists every spa subpage and `/cafe`. No changes needed — bump `<lastmod>` to today on the edited URLs so Google re-crawls sooner.

### Out of scope
- New blog/content marketing (separate effort, bigger lift).
- Google Business Profile optimization (off-site, you'd handle in GBP directly — but the on-page changes above are what feeds the "near me" pack).
- Backlink building.

### Expected impact
- "Near me" recovery terms (22k+ volume, difficulty 9–46) are the biggest unlock — even ranking page 2 on `red light therapy near me` is meaningful traffic.
- `massage livonia` (260/mo, difficulty 10) should rank quickly given the existing page.
- Cafe terms are smaller (`smoothie bar near me` 2.4k/mo) but currently you rank for **none of them** — going from 0 to anything is the win.
- Realistic horizon: 4–8 weeks for Google to re-crawl, re-index, and start showing impressions in GSC.

### Technical notes
- Files touched: `src/pages/Cafe.tsx`, `src/pages/Spa.tsx`, all 8 `src/pages/spa/*.tsx`, `public/sitemap.xml` (lastmod only), homepage components for inline links.
- No backend, no database, no schema changes. Pure frontend/content.
- `ServiceLandingPage` component already supports everything needed — no new components required.
