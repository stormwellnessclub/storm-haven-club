# Spa wraps: benefit-led wording and bring back "Learn more"

## 1. Remove the off-putting lines you named
- Mud Therapy Wrap: remove "not a detox or medical treatment" and "some mud formulas can feel drying…"
- Body Sculpting Wrap: remove "Cosmetic changes, if noticed, are temporary—not fat loss or permanent body reshaping."
- Brightening Vitamin C Wrap: remove "not an instant correction for pigmentation" and "Research relates mainly to formulated skincare used over time, not instant correction…"
- Anti-Aging Collagen Wrap: remove "Topical collagen supports surface conditioning; a wrap is not proven to rebuild deeper collagen or permanently tighten skin."

## 2. Rewrite every wrap the way the Seaweed Ritual is written
For the Anti-Aging Collagen, Brightening Vitamin C, Mud Therapy and Body Sculpting wraps:
- **Intro:** one inviting sentence about what the wrap does and how the guest will feel.
- **Description:** walk through the experience step by step (exfoliation, the wrap, resting, the finish), then the length options.
- **Benefits:** short, confident lines in the Seaweed style, such as "Replenishing hydration: leaves skin soft, supple and conditioned."
- **Take out the warning-style wording everywhere:** the repeated "Benefits depend on the products used… does not guarantee" line, "is not proven to…", and the defensive questions like "Will this reduce fat?" and "Does the mud detoxify my body?". The questions that stay are practical ones: what's the difference between lengths, what to wear, how to prepare.
- **Stays:** the short safety question (allergies, pregnancy, sensitive skin), because it protects guests. No medical cure claims, such as treating arthritis or melasma.
- The Seaweed Ritual and Fire & Ice stay exactly as they are.

## 3. Bring back "Learn more" on the spa menu
On the current Spa page, the wraps lost their link into their own page. Facials still have theirs. I'll add a "Learn more" link under each wrap (Seaweed, Fire & Ice, Collagen, Vitamin C, Mud, Body Sculpting) that opens its full page. Booking stays the same.

## Not changing
Prices, lengths, booking, intake forms, photos.

## Technical
- Copy: `src/lib/bodyWraps.ts` (overview/body/benefits/faqs for the four wraps; drop the `evidence` suffix).
- Links: `SpaEditorial.tsx` passes `viewHref` for Body Wraps (seaweed → `SEAWEED_RITUAL_PATH`, others → `/spa/body-wraps/{slug}` via `bodyWrapDetails`). The existing link text changes to "Learn more" for wraps only.
- Save a project memory: spa wrap copy is benefit-led like the Seaweed Ritual, without disclaimer-heavy wording.
