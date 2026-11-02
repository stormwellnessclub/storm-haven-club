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

## Draft overviews
- Storm Signature: "Our full-body signature massage at medium to deep pressure. Your therapist uses trigger point therapy for knots, warm cherry-pit pillows and weighted salt bags to settle the body, and hot towels to finish. The 90 minutes gives more time on the neck, back and legs."
- Deep Relief: "Firm, focused pressure for chronic tightness, with trigger point therapy on the areas that hold the most tension. Full body, with hot towels and warm salt and cherry-pit pillows. The 90 minutes allows deeper work on the areas you list."
- Lymph & Flow: "Light, rhythmic full-body strokes that support circulation and help you feel less puffy and lighter. Finished with hot towels, warm cherry-pit pillows and weighted salt bags. The 90 minutes adds abdominal and scalp work."
- Prenatal: "A full-body massage for pregnancy, done side-lying with support cushions. It eases the lower back, hips and legs, using trigger point therapy where appropriate, hot towels and warm cherry-pit pillows. The 90 minutes adds more hip and lower-body relief."
- Sports Performance: "Full-body recovery massage with assisted stretching, compression and trigger point therapy, plus hot towels and weighted salt bags. Built for training and sore muscles. The 90 minutes adds more stretching and hip and shoulder mobility work."

Wording stays careful (e.g. "supports," "helps ease"). No medical claims, no "free" (members see "Cupping included for members").

## Open question
- What does the cupping add-on cost for non-members? Until you tell me, the menu will say "Cupping add-on available, included for members" with no price.

## Technical details
- Add `src/lib/massages.ts`, modeled on `bodyWraps.ts`: base name from the "— 60/— 90" suffix, `massageVariants()`, shared "included in every massage" list, and per-treatment details.
- Spa menu: one card per base name with the price for each length. The booking modal offers length choices and passes the selected original service record.
- Save the massage inclusions and cupping rule to project memory, and add an `AGENTS.md` rule.
- Add tests for grouping, the prices shown, and that the selected variant is passed to booking.
