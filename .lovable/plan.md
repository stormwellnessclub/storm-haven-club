

## Fix: Update All Location References from Dearborn to Livonia, MI

The "Dearborn, Michigan" text that appears when sharing a link comes from the Open Graph and meta tags in `index.html`, plus the SEO prerender edge function. These were set as placeholders with the wrong city. The correct address is **18340 Middlebelt Rd, Livonia, MI 48152**.

For local SEO reach, I'll also add nearby city references (Detroit, Dearborn, Farmington Hills, Redford, Garden City, Westland, Novi, Plymouth, Canton, Northville) to the structured data and meta descriptions so search engines associate Storm Wellness Club with the surrounding 15-20 mile radius.

### Files to update (11 files, ~160 replacements)

**1. `index.html`** — Main source for link sharing previews
- Title, description, OG tags, Twitter tags: "Dearborn, MI" → "Livonia, MI"
- Geo meta tags: coordinates → 42.4034, -83.3497 (18340 Middlebelt Rd)
- JSON-LD: Add `streetAddress: "18340 Middlebelt Rd"`, `postalCode: "48152"`, `addressLocality: "Livonia"`, update coords
- Add `areaServed` to JSON-LD listing nearby cities within 15-20 miles

**2. `supabase/functions/seo-prerender/index.ts`** — Crawler-facing HTML
- All page descriptions: "Dearborn, MI" → "Livonia, MI"  
- JSON-LD structured data: address, coords
- Footer text
- Add `areaServed` with nearby cities

**3. `supabase/functions/serve-static/index.ts`** — Site audit HTML
- "Dearborn, Michigan" → "Livonia, Michigan" in audit content
- Update meta description references

**4. `supabase/functions/serve-static/full-site-content.ts`** — AI/crawler content
- "Dearborn, Michigan" → "Livonia, Michigan" (2 locations)

**5. Page components with SEOHead descriptions:**
- `src/pages/Index.tsx` — home description
- `src/pages/Classes.tsx` — classes description  
- `src/pages/Apply.tsx` — apply description
- `src/pages/Spa.tsx` — spa description
- `src/pages/KidsCare.tsx` — kids care description
- `src/pages/GuestPass.tsx` — guest pass description

**6. `src/pages/SiteAudit.tsx`** — internal audit page

### SEO radius strategy

Add to the JSON-LD `areaServed` property in `index.html` and `seo-prerender`:
```json
"areaServed": [
  { "@type": "City", "name": "Livonia, MI" },
  { "@type": "City", "name": "Detroit, MI" },
  { "@type": "City", "name": "Dearborn, MI" },
  { "@type": "City", "name": "Farmington Hills, MI" },
  { "@type": "City", "name": "Redford, MI" },
  { "@type": "City", "name": "Garden City, MI" },
  { "@type": "City", "name": "Westland, MI" },
  { "@type": "City", "name": "Plymouth, MI" },
  { "@type": "City", "name": "Canton, MI" },
  { "@type": "City", "name": "Northville, MI" },
  { "@type": "City", "name": "Novi, MI" },
  { "@type": "City", "name": "Southfield, MI" }
]
```

This tells Google the club serves all these areas, improving visibility across the metro region while displaying the correct Livonia address.

