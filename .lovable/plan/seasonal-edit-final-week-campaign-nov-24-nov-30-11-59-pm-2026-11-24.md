# Seasonal Edit: Final-Week Campaign (Nov 24 – Nov 30, 11:59 PM)

## The real problem
The emails failed because each one was a standalone flyer: same line, same layout, everything offered at once, sent to everyone, from the same address as receipts. There was no story, no reason to open today vs. tomorrow, and no different message for different people. This plan replaces that with one connected week.

## The big idea: "The Seasonal Edit — Seven Days, Seven Openings"
One theme for the whole week: each day "opens" one part of the Edit, like an advent calendar. Every message has one focus, one button, and a clear "why today." The full Edit stays available all week, but each day spotlights one thing.

## Who gets what (4 audiences, not 2)
1. Members — own-use offers (Member Movement Edit, member massage pricing by tier, PT plans), plus gifting at listed price.
2. Active non-members (bought, booked or visited in the last 12 months) — Discovery Pass, Movement Edit, Club Experience, massage, PT.
3. People who clicked or opened earlier Seasonal Edit emails but didn't buy — follow-up with the exact thing they clicked.
4. Imported list — only addresses that ever opened; the rest pause to protect inbox placement.

## Day-by-day
| Day | Opening | Members | Non-members | Channel |
|---|---|---|---|---|
| Tue 24 | "The Edit is open" — interactive picker: *What do you want December to feel like?* (Stronger / Calmer / Restored / Giving) → each answer links to its offer | Yes | Yes | Email + text (the 9 AM text becomes this teaser) |
| Wed 25 | Movement — classes (Movement Edit, Discovery, Club Experience / Member Movement Edit) | Yes | Yes | Email |
| Thu 26 Thanksgiving | Gratitude note only, no hard push; gift reveal card (see below) | Yes | Yes | Email only |
| Fri 27 | Massage gifts + the reveal card for gifting | Yes | Yes | Email + text |
| Sat 28 | Personal Training — trainer's short personal note, payment plans explained in one line | Yes | Yes | Email |
| Sun 29 | Clicked-not-bought follow-up: "You looked at ___" | Only segment 3 | Only segment 3 | Email |
| Mon 30 | Final day: "Closes tonight at midnight" — short, plain, urgent | Yes | Yes | Email morning + text afternoon |

Texts: 3 total in the week (24, 27, 30), consent-checked, no late hours.

## The gift reveal card (what it looks like)
- Email shows a sealed cream card with a dark-brown wax-style Storm logo seal and the line "Someone deserves a quiet hour."
- Tapping "Open the card" goes to a page on your website where the card flips open with a gentle animation.
- Inside: three choices with real prices — a 60-minute massage, a Movement Edit class pack, or a gift card amount — each with a "Send this gift" button straight into the gift shop.
- Buyer can add a name and message; the person receiving gets the same card-opening animation in their email.
- Members see a small note: member pricing is for your own use; gifts are at listed price.
- Style: real logo, paper texture, typed wording only — no computer-made photos.

## Fixing why emails land in spam
- Separate marketing sender (e.g. hello@ on a marketing subdomain), so receipts stay safe.
- Every email has a real text version, fewer and smaller images, one link focus.
- Send to engaged people first, then the rest a few hours later.
- Bounced/spam-report addresses already stopped; imported non-openers paused.

## Measuring it
Campaign Studio → Results shows opens, clicks and purchases for each day's send, so after Day 2 we double down on what works and drop what doesn't.

## Copy rules applied
Never "sale," "free," "Black Friday" or the processing fee; no repeating "invest in what lasts"; brand voice and banned phrases respected.

## Decisions needed from you
- The 9 AM texts today: I recommend replacing them with the Day 1 teaser above (they're still scheduled as you chose unless you say otherwise).
- OK to pause imported addresses that never opened.
- Who manages your domain settings, for the marketing sender.

## Technical section
- Build the picker and reveal-card landing pages as public routes linking into existing gift shop / Seasonal Edit sections (preselected offers).
- Gift recipient email reuses the gift-card delivery email with the card animation (GIF fallback for email clients).
- All sends as Campaign Studio campaigns with self-removing timers; segment 3 built from `marketing_email_events` clicks without purchases in `revenue_ledger`.
- Texts through `send-sms`, no consent bypass.
