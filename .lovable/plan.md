# Regenerate the 3 smoothie images as a matched set

Replace the current 3 Functional Smoothie images (Orange Creamsicle, Coconut Cloud, Hailey Bieber) with a fresh AI-generated set that shares one look, so they read as a cohesive menu row.

## Visual direction (all 3 images identical except contents)

- **Vessel:** tall clear glass with a clean rim, no logo, no straw
- **Angle:** straight-on, eye-level, subject centered
- **Background:** soft off-white / warm cream, seamless — no props, no ingredients scattered around
- **Lighting:** bright, diffused daylight from the left, soft natural shadow
- **Framing:** square 1024x1024, subject fills ~75% of frame with even margin
- **Style:** editorial food photography, crisp, minimal, premium wellness feel

## Per-drink contents

1. **Orange Creamsicle** — creamy pale orange smoothie, vanilla-cream swirl at top, small orange zest garnish
2. **Coconut Cloud** — bright white smoothie, light foam on top, single toasted coconut flake garnish
3. **Hailey Bieber Smoothie (Strawberry Glaze)** — pale pink strawberry smoothie, glossy strawberry-glaze drizzle down one inside wall of the glass, one fresh strawberry slice on the rim

## Where they live

Saved to `src/assets/cafe/` as `smoothie-orange-creamsicle.jpg`, `smoothie-coconut-cloud.jpg`, `smoothie-hailey-bieber.jpg`, then uploaded to the `cafe-menu-images` storage bucket. The 3 matching `cafe_menu_items` rows get `image_url` swapped to the new URLs; old images are deleted from storage so nothing is orphaned.

Category reorder (smoothies first) is included in the same pass.

## If you want to tweak

Tell me before I build: different glass (mason jar, stemless), different background color, add a garnish rule, drop the strawberry drizzle, etc. Otherwise I'll build as described.
