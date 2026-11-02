# Massages: one listing per treatment + premium descriptions

## What changes for guests
- The spa menu shows 5 massage cards instead of 10: Storm Signature, Deep Relief, Lymph & Flow, Prenatal, Sports Performance.
- Each card shows both lengths and prices (e.g. "60 min $155 · 90 min $198"). Guests pick the length when they book, the same way the body wraps work.
- Each card gets a short, sensory overview that reads like an experience. "Learn more" opens the full story: what the session feels like, what makes the 90 minutes different, who it's for, and what to tell the therapist first.
- Prices, lengths, availability, intake forms and existing appointments stay the same.

## Draft overviews (Storm brand voice, no "free", no emojis)
- Storm Signature: "Slow, unhurried bodywork in a warm, softly lit room, guided by breath and long, grounding strokes. Designed to quiet the mind as much as the muscles. The 90 minutes adds deeper neck, scalp and lower-body work."
- Deep Relief: "Focused, intentional pressure that works into the tension you carry every day. Each layer is released with care, never rushed. The 90 minutes allows time for fascia work and the areas you name."
- Lymph & Flow: "Light, rhythmic movements that encourage circulation and leave the body feeling lighter and calmer. The 90 minutes adds gentle abdominal work and a scalp finish."
- Prenatal: "A cushioned, side-lying ritual made for pregnancy, easing the lower back, hips and the weight you're carrying. The 90 minutes adds lower-body decompression and guided rest."
- Sports Performance: "Recovery-driven bodywork that combines compression, assisted mobility and stretching to help you train again feeling restored. The 90 minutes adds hip, shoulder and joint mobility work."

Benefit wording stays careful (e.g. "supports," "helps ease"), with no medical claims.

## Technical details
- Add `src/lib/massages.ts`, modeled on `bodyWraps.ts`: base name from the "— 60/— 90" suffix, `massageVariants()`, and per-treatment details (overview, body, benefits, FAQs).
- Spa menu: collapse Massage rows to one card per base name and show the price for each length. The booking modal offers duration choices from the variants and passes the selected original service record (same pattern as the wraps).
- Learn-more content is shown from the details file. Database descriptions are not touched.
- Add tests: grouping, the 60/90 prices shown, and that booking receives the selected variant's ID.
- Add a project rule to `AGENTS.md`.
