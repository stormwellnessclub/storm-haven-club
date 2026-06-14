## What the audit found (just ran)

**Semrush snapshot** — stormwellnessclub.com ranks for **83 keywords**, ~489 visits/mo estimated. Every ranking term is still gym/wellness-club branded. **Zero impressions** for cafe, smoothie, açaí, juice, coffee, spa, recovery, red light, cryo, sauna, massage, etc. The cafe rewrite from last week has not been recrawled yet (`/cafe` returns "no data" — Semrush hasn't re-indexed it).

**Active SEO scanner findings (failing right now):**

| Finding | Severity | What's broken |
|---|---|---|
| `gsc:gsc` | mid | **Google Search Console isn't connected** — biggest miss. No GSC = no indexing data, no sitemap submission, no "request indexing" for /cafe and spa subpages. |
| `http:robots` | mid | `robots.txt` Sitemap directive points at `cqzmrdzwgsujgbjqpoxh.supabase.co` instead of `stormwellnessclub.com`. |
| `http:sitemap` | mid | Sitemap entries use `www.stormwellnessclub.com` (canonical is non-www); missing routes: `/classes/:classTypeId`, `/book`, `/mothers-day`, `/mothers-day/success`, `/mothers-day/redeem`. |
| `http:llms_txt` | low | `/llms.txt` exists but should be re-checked for new cafe/spa pages. |
| `agent_metadata:metadata_quality` | low | A few titles/descriptions exceed 60/160 char limits (index.html, Index.tsx, MothersDay*, ClassTypeDetail). |
| `agent_metadata:social_preview` | low | Redundant brand suffix in some og:titles. |
| `lighthouse:performance` | low | Slow LCP on homepage hero. |
| `lighthouse:accessibility` | low | Color-contrast issues. |

**Bigger-picture keyword gaps** (Semrush, all US database):
- `cafe near me` 368k/mo · `smoothies near me` 301k/mo · `acai bowl near me` 74k/mo · `juice bar near me` 27k/mo — we rank for none.
- `acai bowl livonia` — zero search volume (good — confirms "near me" is the right target, not "livonia").

---

## Plan

### 1. Fix the scanner issues that block discovery (high impact)
- **`public/robots.txt`** — change `Sitemap:` line to `https://stormwellnessclub.com/sitemap.xml`.
- **`public/sitemap.xml`** — switch all `<loc>` from `www.stormwellnessclub.com` → `stormwellnessclub.com` (match canonical). Add missing routes: `/classes/:classTypeId` (one entry per class type from the same source the page uses), `/book`, `/mothers-day`, `/mothers-day/redeem`. Skip `/mothers-day/success` (post-checkout, no SEO value).
- **`index.html`** — shorten `<title>` and meta description to <60/<160 chars; strip redundant brand suffix from og:title.
- **`src/pages/Index.tsx`, `MothersDayPackRedeem.tsx`, `ClassTypeDetail.tsx`** — trim per-route title/description to spec.

### 2. Connect Google Search Console (single biggest win)
- Trigger the GSC connector → verify `stormwellnessclub.com` via META tag → submit sitemap → request indexing for `/cafe`, `/spa`, all 8 `/spa/*` subpages so Google recrawls last week's rewrites within days instead of weeks.

### 3. Strengthen Cafe page for the keyword tier we're missing
Last week's rewrite targeted "smoothie bar / protein shakes / açaí." Add the higher-volume terms still missing:
- **"cafe near me" / "coffee near me" / "juice bar near me"** — weave naturally into the H1 subhead and intro paragraph. Current H1 is "Smoothie Bar, Protein Shakes & Açaí Bowls in Livonia, MI" — extend the editorial intro to mention "café and juice bar serving the Detroit metro."
- Add a short **"Healthy Café Near Livonia"** section with `juice bar`, `coffee shop`, `breakfast smoothies` phrasing.
- Add **Detroit-metro city names** (Farmington Hills, Plymouth, Northville, Novi, Redford, Westland, Canton) in a single visible "Serving" line — same trick used on spa pages.
- Extend `FAQPage` JSON-LD with: "Do you have a juice bar near Livonia?", "Is the café open for breakfast?", "What's the best protein shake near me?"

### 4. Add `/llms.txt` cafe + spa entries
Update `public/llms.txt` to list `/cafe` and each `/spa/*` subpage with one-line descriptions so ChatGPT/Perplexity/Claude can summarize them when users ask about wellness/recovery/cafes in Livonia.

### 5. Trigger a fresh SEO scan
After the above lands, run `seo--trigger_scan` so the scanner re-verifies metadata + sitemap + robots and clears the failing rows.

---

### Out of scope (call out, don't do)
- Backlink building, Google Business Profile optimization, paid ads — off-page work the user handles outside the app.
- Blog/content marketing (separate, bigger lift).
- Republishing for the lighthouse performance finding — needs a hero-image refactor; flag for a follow-up.

### Expected impact
- GSC connection + sitemap/robots fix → Google recrawls the cafe + spa rewrites within ~1 week instead of 4–8.
- Cafe page targeting the bigger "cafe / juice bar / coffee near me" terms in addition to smoothie/açaí → wider net for any non-zero impressions.
- Metadata trims → cleaner SERP snippets, fewer truncated titles.

### Files touched
`public/robots.txt`, `public/sitemap.xml`, `public/llms.txt`, `index.html`, `src/pages/Cafe.tsx`, `src/pages/Index.tsx`, `src/pages/MothersDayPackRedeem.tsx`, `src/pages/ClassTypeDetail.tsx`. No backend, no schema. Plus one GSC connector flow and one SEO rescan.
