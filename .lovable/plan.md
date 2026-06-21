## Plan: Café face-lift — pilot images first

### Phase 1: Pilot batch (this round)
Generate 4 test photos covering the main item types so you can judge the style:
1. One **smoothie** (in a tall glass)
2. One **açaí bowl** (in a ceramic bowl with toppings visible)
3. One **cold-pressed juice** (in a bottle)
4. One **snack/food item** (plated)

**Locked art direction** (same across all):
- Soft natural daylight, warm cream/sand backdrop, light linen or stone surface
- 3/4 overhead angle, neutral ceramic/glass serveware
- A small sage garnish or fresh ingredient prop for warmth
- No text, no logos, no people, no brand marks
- Square 1024×1024, `standard` quality tier

Saved to `src/assets/cafe/pilot-*.jpg` and dropped into a temporary "Style Preview" section at the top of `/member/cafe` so you can see them rendered at real size in the actual layout.

### Phase 2: You review
You tell me:
- ✅ Style is right → proceed to full rollout
- 🔧 Tweak X (lighting too warm, want darker backdrop, different dishware, more vibrant, etc.) → I regenerate the 4 with the tweak
- ❌ Wrong direction → we rethink before spending more

### Phase 3: Full rollout (only after approval)
- Generate one photo per remaining `cafe_menu_items` entry using the approved style
- Externalize each via `lovable-assets` to keep the repo light
- Run one SQL migration to update every item's `image_url` to the new CDN URL (items with existing real photos: skipped unless you say otherwise)

### Phase 4: Layout redesign
Build the chosen layout (still need your A / B / C pick — but we can defer that decision until after the pilot images so you can judge them together):
- A — Hero + Photo Grid + Right Cart
- B — Sectioned List + Sticky Bottom Cart
- C — Editorial Magazine + Right Cart

Palette locked: Cream `#FDFBF7`, Sand `#EAE6DF`, Terracotta `#A65D43`, Soft Sage `#87A878`.
Applies to `/member/cafe`, `/non-member/cafe`, and public `/cafe` — chrome of each surface untouched.

### What I need from you before I start Phase 1
Pick 4 actual menu items from your current café menu so the pilot photos are real items you can judge in context. Reply with the names (e.g. "Storm Smoothie, Berry Açaí Bowl, Green Glow Juice, Avocado Toast"), or say "you pick" and I'll grab the top 4 from the database.
