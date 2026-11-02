# Massages: one listing per treatment + specific premium descriptions

## What changes for guests
- The spa menu shows 5 massage cards instead of 10: Storm Signature, Deep Relief, Lymph & Flow, Prenatal, Sports Performance.
- Each card shows both lengths and prices (e.g. "60 min $155 · 90 min $198"). Guests pick the length when they book, the same way the body wraps work.
- Each card says plainly what happens in the session. "Learn more" shows what's included, the pressure, what the 90 minutes adds, and the cupping add-on.
- Prices, lengths, availability, intake forms and existing appointments stay the same.

## Included in every massage (shown on every card)
- Full-body massage unless the client asks for focus areas on their intake form
- Trigger point therapy
- Hot towels
- Weighted Himalayan salt bags and warm cherry-pit pillows
- Cupping add-on, included for members with their massage

## Draft overviews (card text, then "Learn more" adds the full included list)
- Storm Signature: "The massage you'll keep coming back for. Medium to deep pressure meets every knot with trigger point therapy, while warm cherry-pit pillows and weighted Himalayan salt bags sink you deeper into stillness. It ends with hot towels and a body that finally feels like yours again. Choose 90 minutes when one hour is never enough."
- Deep Relief: "For the tension you've carried for months. Slow, firm pressure and trigger point work release the shoulders, back and hips layer by layer, never rushed. Warm salt bags and hot towels soften the body between the deep work, so you leave loose, light and grounded. The 90 minutes gives your therapist time to truly undo it."
- Lymph & Flow: "Light, rhythmic strokes that wake up circulation from head to toe, including gentle work on the stomach, to help ease puffiness and that heavy, bloated feeling. You'll leave feeling lighter, clearer and calm. The 90 minutes slows everything down for more full-body work and a lymphatic facial massage to depuff and brighten the face."
- Prenatal: "An hour that's entirely for you and your changing body. Rest face down on our specially designed pregnancy pillow, or side-lying, whichever feels best, while your therapist eases the lower back, hips, legs and swollen feet. Warm cherry-pit pillows and hot towels add comfort you'll want to come back for. The 90 minutes gives more time for the hips and lower body."
- Sports Performance: "Recovery for people who train. Deep compression, trigger point therapy and assisted stretching work through tight hips, hamstrings and shoulders, so you move freer and bounce back faster. Finished with hot towels and weighted salt bags. The 90 minutes adds more stretching and mobility work."

Wording stays careful (e.g. "supports," "helps ease"). No medical claims, no "free" (members see "Cupping included for members").

## Open question
- What does the cupping add-on cost for non-members? Until you tell me, the menu will say "Cupping add-on available, included for members" with no price.

## Technical details
- Add `src/lib/massages.ts`, modeled on `bodyWraps.ts`: base name from the "— 60/— 90" suffix, `massageVariants()`, shared "included in every massage" list, and per-treatment details.
- Spa menu: one card per base name with the price for each length. The booking modal offers length choices and passes the selected original service record.
- Save the massage inclusions and cupping rule to project memory, and add an `AGENTS.md` rule.
- Add tests for grouping, the prices shown, and that the selected variant is passed to booking.
