# Add the Spa section to the Seasonal Edit page

## Why it's missing
The Seasonal Edit page has no spa section at all yet. It was held back while the body wrap offer and the wet spa question (women only) were still open. The massage offers already exist, but only on the gift page.

## What I'll add now
A "Spa" section after the classes, for both Members and Non-members tabs:

- **The gift of a massage** — the seven Seasonal Edit massages with their prices ($120, $170, $160, $150, $180, $150, $195), in the same dark brown look as the flyers.
- **Members** see the crossed-out Seasonal Edit price with "Member Price (your tier · % off)", the same wording as booking. Signed-out members see the tier list (Silver 5%, Gold 8%, Platinum 10%, Diamond 12%).
- Each massage has a **Choose this massage** button that opens the gift page with that massage already picked, for themselves or someone else.
- "Through November 30" and "Available in limited quantities."

## Not included yet (needs your decisions)
- Body wrap Seasonal Edit pricing
- Spa + wet spa packages for non-members, and what men get instead of wet spa access

When you decide those, they'll be added to the same section.

## Technical details
- New `src/components/seasonal/SpaEditSection.tsx`, rendered in `BlackFriday.tsx` after `MovementEditSection`/`RedeemClassGift`, receiving `audience`.
- Reads active massage gift offers from `gift_card_offers` (same source as GiftCardStore), uses `memberPriceLabel()` and the member's tier for discounted display; no pricing logic changes.
- Links to `/shop?gift=<offer id>#gift-cards`; verify GiftCardStore preselects massage offers by that param, adding support if missing.
- Check phone layout (no photos) and both tabs with Playwright.
