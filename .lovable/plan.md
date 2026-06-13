## Personal Training UI refinements

Scope: `src/pages/personal-training/Overview.tsx` only. Copy edits and one removed tile — no layout, routing, or functional changes.

### 1. Hero subhead (lines 62–66)
Remove the trailing "— by a certified coach who knows your name." clause.

New copy:
> Private coaching at Storm Wellness Club. Every session is programmed around your goal, your level, and where your body is today.

### 2. Hero sidebar (lines 85–93)
Remove the entire "Who it's for" block (the "Members and the wider Detroit metro community — beginners welcome, advanced respected." item). Leave the "Where" and "Session length" blocks untouched.

### 3. Philosophy tiles (lines 171–183)
Remove the "Certified coaches" tile entirely. Rewrite the remaining two and add a third so the section reads as premium, science-led, Storm Method, 15 years in the space. Keep the existing 3-column grid intact.

Proposed copy (open to tweaks):

- **The Storm Method**
  A proprietary coaching framework refined over 15 years in the industry — assessment, programming, and progression built on movement science, not trend.

- **Programmed for your physiology**
  Every plan is written around your goal, your training age, and your body's current capacity. Strength, mobility, Pilates, post-rehab, sport-specific — calibrated, never recycled.

- **Progressed with intent**
  Load, tempo, and volume are tracked and progressed week to week so adaptation compounds. Measured work, measurable change.

### Out of scope
- `PersonalTrainingPage.tsx` (the per-format detail pages) and the "Who it's for" bullet list rendered there.
- Pricing, request form, and all other sections of Overview.
- Sub-pages: `OneOnOne.tsx`, `PrivatePilates.tsx`, `SemiPrivate.tsx`.

Confirm the three rewritten tiles read the way you want, or tell me to adjust wording / add a fourth (e.g. a 15-years stat tile) before I implement.
