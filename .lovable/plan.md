# Premium "Functional Blend" Section for Cafe Smoothies

## Goal

Today the entire smoothie description (intro paragraph + "Functional Blend" + ingredient list) is dumped into one block of body text in the item details dialog. The user wants the **Functional Blend** pulled out and presented as a clean, motivating, premium list — so guests actually *feel* why the drink is worth ordering.

This is a **frontend-only, presentation-only** change in `src/components/cafe/CafeOrderContent.tsx`. No DB edits, no copy edits, no menu admin changes. Existing description text in the database already contains everything we need; we just parse and style it better.

## What changes visually

In the item details dialog (when a guest taps a smoothie card), the body becomes three distinct zones instead of one paragraph:

```text
┌─────────────────────────────────────┐
│  [hero image]                       │
├─────────────────────────────────────┤
│  Short intro paragraph              │ ← lead description only
│                                     │
│  ─── FUNCTIONAL BLEND ───           │ ← thin rule + uppercase label
│                                     │
│  TRIPLE COLLAGEN COMPLEX            │ ← serif/display, burgundy
│  Supports skin, hair, nails,        │ ← body, muted burgundy
│  joints, and connective tissue.     │
│  ─────────────                      │ ← hairline divider
│  VITAMIN C                          │
│  Supports collagen synthesis,       │
│  immune health, antioxidant…        │
│  ─────────────                      │
│  …                                  │
│                                     │
│  Dietary tag chips                  │
└─────────────────────────────────────┘
```

Styling stays inside the existing cafe design tokens (`cafe-burgundy`, `cafe-mono`, `cafe-line`, `cafe-stone`, `cafe-terracotta`) so it matches the rest of the menu — no new colors, no generic UI. Ingredient names use the existing serif/display weight; benefits use body type at a slightly muted burgundy. Hairline `cafe-line` dividers between ingredients give it the "internal, printed menu" feel.

The "Add to Order" CTA and add-on flow are untouched.

## Technical details

File: `src/components/cafe/CafeOrderContent.tsx` only.

1. **Parser update — `parseItemDescription`** (around lines 62–92)
   - Add a new section split for `Functional Blend\s*:?` (case-insensitive), alongside the existing `Benefits:` and `Nutrition:` splits.
   - Strip a leading line that exactly matches the item name (DB entries repeat the name as line 1, e.g. `Coconut Cloud\nA nourishing blend…`) so the intro paragraph reads cleanly.
   - Return a new field `functionalBlend: Array<{ ingredient: string; benefit: string }>`.
   - Support both formats present in the DB:
     - **Block format** (Coconut Cloud, Hailey Bieber): ingredient name on its own line, benefit on the next non-empty line, blank line between entries.
     - **Bullet format** (Orange Creamsicle): `• Lion's Mane — Supports focus…` — split on the em-dash / en-dash / hyphen.
   - Trim, drop empty entries, keep order.

2. **Detail dialog render** (around lines 1199–1228)
   - Keep the intro `description` paragraph as-is at the top.
   - Insert a new `Functional Blend` block before `Benefits` / `Nutritional Profile` when `functionalBlend.length > 0`:
     - Label: existing `font-cafe-mono text-[9px] tracking-widest uppercase` treatment, centered with thin `cafe-line` rules on either side for editorial framing.
     - Each entry: ingredient name in `font-serif` / display weight, uppercase tracking, `text-cafe-burgundy`; benefit underneath in `text-sm text-cafe-burgundy/75 leading-relaxed`.
     - `divide-y divide-cafe-line/60` between entries for the hairline look.
   - `Benefits` and `Nutritional Profile` sections render unchanged when present (legacy items still work).

3. **No changes** to: DB schema, menu admin, cart logic, add-on flow, pricing, images, routing, or other categories. Non-smoothie items that have no "Functional Blend" line render exactly as they do today.

## Out of scope

- Editing the actual description text in the database (we keep your existing copy).
- Restyling the menu grid / card list — only the details dialog changes.
- Any backend / RLS / Stripe work.
