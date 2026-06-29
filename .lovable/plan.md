
# Gut Reset Program Page (`/gut-reset`)

Public marketing + purchase page that mirrors the copy from your current Storm Fitness detox page, restyled to match Storm Wellness Club's design system. Admin can schedule upcoming sessions; customers purchase a 3-day ($265) or 5-day ($375) reset tied to a scheduled start date.

## Public page — `/gut-reset`

Sections (copy mirrored from stormfitnessandwellness.com/detox):

1. **Hero** — "Gut Reset Cleanse Program — Revitalize Your Well-Being from Within" + subhead from "Discover The Power Of Organic Purity"
2. **Upcoming sessions** — Live from DB. Each upcoming reset shows start date, length (3 or 5 day), spots remaining, two "Reserve" buttons (3-Day $265 / 5-Day $375). If none scheduled: "No resets currently open — check back soon."
3. **Why a Gut Reset** — the four pillars (Nourish Your Gut, Weight Loss Support, Anti-Inflammatory, Organic & Pure)
4. **What's included** — three-column overview: Proprietary Drinks, Curated Salads, Invigorating Shots
5. **The Drinks** — full menu: Booster (Morning Vitality Elixir), Awaken Storm (Metabolism Igniter), Storm Biotic, Storm Digest, Green Storm, Bloody Storm
6. **Infused Waters** — Rose Hibiscus Elixir, Lemon Charcoal Cleanse, Chlorophyll Chia Water, Oxygen Water, Pineapple Paradise, Ginger Spice Revive
7. **Salads & Shots** — Digestive Reset Salad, Gut Protective Salad, Gut Food Salad, Morning Gut Balancer Shot, Oxygen Revive Shot, Post-biotic Revival Shot
8. **Snacks** — Gut Seal Chia Pudding, Gut Rejuvenation Trail Mix, Veggie Crunch Pack
9. **Who can benefit** + **Benefits** (Gut Reset, Increased Energy, Mental Clarity, Improved Skin)
10. **FAQ** — common questions (what's the difference between 3 vs 5 day, do I have to pick up daily, allergens, etc.)
11. **Sticky CTA** — anchor back to upcoming sessions

Style matches `ServiceLandingPage.tsx` patterns (hero, breadcrumbs, body, FAQ, CTA bands). SEO: title, meta description, Service + FAQ + Breadcrumb JSON-LD, sitemap entry.

## Nav + footer

- "Gut Reset" added to main `Navigation.tsx` nav list and footer.

## Admin page — `/admin/gut-reset`

Gated to admin / manager / super_admin. Tabs:

- **Upcoming Sessions** — list/create/edit/cancel scheduled resets. Form: start date, length (3 or 5 day), capacity, optional notes/internal flag, status.
- **Past Sessions** — read-only history with purchase counts.
- **Purchases** — per session: name, email, phone, option chosen, payment status, Stripe receipt link, refund button.

## Purchase flow

1. User clicks "Reserve 3-Day / 5-Day" on a scheduled session.
2. If not signed in → small form for name/email/phone (members auto-filled from profile).
3. Edge function `gut-reset-create-checkout` validates capacity, creates a Stripe Checkout session (one-time payment) with metadata `{ session_id, option }`, returns URL.
4. Redirects to Stripe Checkout.
5. Success URL → `/gut-reset/success?session_id=…` calls `gut-reset-verify-payment` which marks purchase paid and increments `spots_taken`.

Members and non-members pay the same price.

## Technical details

**New tables:**

- `gut_reset_sessions` — start_date, length_days (3|5), capacity, spots_taken, status, notes
- `gut_reset_purchases` — session_id, option, customer_name, email, phone, user_id (nullable), stripe_session_id, amount_cents, status (pending/paid/refunded)

RLS: public SELECT on `gut_reset_sessions` where status='scheduled'; purchases admin-only + own row visible to buyer. GRANTs included.

**Stripe products** (create via tool):
- "Gut Reset — 3 Day" — $265 one-time
- "Gut Reset — 5 Day" — $375 one-time

**New edge functions:**
- `gut-reset-create-checkout`
- `gut-reset-verify-payment`

**New files:**
- `src/pages/GutReset.tsx`
- `src/pages/GutResetSuccess.tsx`
- `src/pages/admin/GutResetAdmin.tsx`
- `src/hooks/useGutResetSessions.ts`
- Route additions in `App.tsx` + admin sidebar entry
- Nav link in `src/components/Navigation.tsx` + footer link
- Sitemap entry in `public/sitemap.xml`

## What I still need from you (can answer after approval)
- Hero image: pull from existing Storm Wellness assets or upload a new one?
- Any allergen / pickup-time / start-day-of-week info you want included up front?
