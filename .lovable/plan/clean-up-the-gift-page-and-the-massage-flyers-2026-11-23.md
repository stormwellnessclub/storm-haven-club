# Clean up the gift page and the massage flyers

## 1. Massage flyers
- Take the line "each gift covers the full massage" off all 8 logo-and-texture massage flyers.
- Save them as new "-v2" versions in the "Seasonal Edit massage flyers" folder. The current flyers stay in Files.

## 2. Gift page: massage prices
- Massages are no longer listed in the "Spa service" tab, where they showed regular prices ($155–$225). Through Nov 30, massage gifts are sold only at the Seasonal Edit prices ($120, $150, $160, $170, $180, $195).
- Take the "Each gift pays for the whole massage…" wording off the gift page too.

## 3. Gift page: remove items
- Remove all seven chakra rituals from the Spa service tab.
- Remove the Recovery Day Pass from the gift choices.

## 4. Storm Shop section
- Restyle the shop products below the gift cards to match the gift card design (same headings, spacing, cards and colors). Products, prices and checkout stay the same.

## 5. Class Seasonal Edit gifts
- Add Discovery, Movement Edit and Club Experience as gift choices on the gift page through Nov 30, at their Seasonal Edit prices. When the gift is redeemed, the person gets the same classes and expiry as if they had bought it themselves.
- On the Seasonal Edit page, keep these class offers where they are and add a "Give as a gift" button to each one. The button opens the gift page with that offer already picked.
- The Member Movement Edit stays members-only and isn't sold as a gift.

## Not in this plan
- A spa Seasonal Edit. It's still waiting on your prices and the wet spa decision for men.

## Technical details
- Gift tab: filter category Massage and Body Rituals out of SpaServiceGrid; remove Recovery Day Pass from SERVICE_PRESETS. The gift checkout also refuses those service IDs on the server, so old links can't still sell them.
- Shop: restyle the StormShop.tsx product sections with the editorial components used by GiftCardStore.
- Flyers: regenerate with /tmp/massage-flyers/build.py.
