

## Problem

Claude was able to fetch the site-audit URL but it only contains a metadata summary (page titles, meta descriptions, feature list). It does not contain the actual content visitors see — the hero copy, spa service menu with prices, membership tiers, class descriptions, amenity details, etc. Claude needs all of this to do a real audit.

## Solution

Expand the `serve-static` edge function to serve a comprehensive static HTML document at `?file=full-site-content` that contains the actual rendered content from every public page — all headings, body copy, pricing, service descriptions, and structured data. This is a single large HTML file that gives Claude (or any AI) complete visibility into the site.

## Changes

### 1. Update `supabase/functions/serve-static/index.ts`

Add a new `file === "full-site-content"` route that returns a complete HTML document organized by page, containing:

**Homepage (`/`)**
- Hero: "The Wellness Solution You Have Been Seeking" + subtext
- Three studios section (Reformer Pilates, Cycling, Aerobics Room)
- Spa preview (Signature Facials, Therapeutic Massage, Body Treatments)
- Member benefits (Recovery Suite amenities, Lifestyle amenities)
- Philosophy: "A Blend of Science & Soul"
- Café preview: "Nourish From Within"
- Kids Care preview
- Final CTA

**Memberships (`/memberships`)**
- 4 tiers with full pricing: Silver ($200/mo), Gold ($250/mo), Platinum ($350/mo), Diamond ($500/mo)
- Annual fees, features per tier, childcare add-on pricing, class notes
- Core amenities list, spa amenity descriptions

**Classes (`/classes`)**
- All class types with descriptions (Reformer Pilates heated/non-heated, Indoor Cycling, Yoga, HIIT, Barre, Mat Pilates, Bootcamp, Sculpt)

**Spa (`/spa`)**
- Full service menu with all prices:
  - Body Rituals (7 chakra rituals, $205-$295)
  - Body Wraps (10 wraps, $150-$235)
  - Massage (6+ types, $120-$195)
  - Facials and other categories

**Amenities (`/amenities`)**
- Recovery Suite: Infrared Sauna, Steam Room, Cold Plunge, Salt Room
- Premium: Red Light Therapy, ZeroBody Cryo
- Lifestyle amenities

**Kids Care (`/kids-care`)**
- Room structure (Little Stars, Big Stars), age ranges, capacities
- Hours, features, pricing

**Apply, Guest Pass, Class Passes, Café, FAQ, Merch, Terms, Privacy** — key content from each

### 2. Update `src/pages/SiteAudit.tsx`

Add a second button: **"Copy Full Content Link for AI"** that copies the new URL:
`https://cqzmrdzwgsujgbjqpoxh.supabase.co/functions/v1/serve-static?file=full-site-content`

Also keep the existing audit summary link.

### 3. Update existing `?file=site-audit` HTML

Add a link/note at the top pointing to the full content version for deeper auditing.

---

## What Claude Gets

When you paste the full-content URL into Claude, it will fetch a static HTML page containing every piece of text content on your site — hero copy, pricing tables, service menus, class descriptions, amenity details, membership tiers, and more. This gives Claude everything it needs for a complete site audit, content review, or SEO analysis.

