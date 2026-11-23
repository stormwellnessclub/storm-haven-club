# Name the member level on member prices, and make the member flyers clearer

## The answer today
Yes, members can see they're getting preferred pricing. When a member books a massage or spa service, they see:
- the regular price crossed out
- their lower price
- the words "Member Price" underneath

It doesn't say which membership level the price comes from.

## 1. Add the member level to the label
Change "Member Price" to "Member Price (Gold · 8% off)", using each member's own level. Prices still show as the old price crossed out next to the member price. No dollar savings line is added.
- This applies wherever a member books spa or massage services, plus the massage gift page.

## 2. Member massage flyers, version 2
- Show the Seasonal Edit price crossed out next to "Member pricing". Add one line underneath: "Member pricing varies by tier: Silver 5% · Gold 8% · Platinum 10% · Diamond 12% off."
- Add "Your member price shows automatically when you book."
- Keep the same three designs. Save them as new versions next to the current ones, ready for the member email campaign.

## Not in this plan
The body wrap offer, wet spa access, and members buying gifts for non-members still need your answers. I'll ask those again separately.

## Technical details
- `src/components/booking/SpaBookingModal.tsx`: use `memberTierRate` from `src/lib/spaPackages.ts` and label as `Member Price (Tier · N% off)`. Apply the same label in `src/pages/GiftCardStore.tsx` and the other member spa price displays.
- Regenerate the flyers as `seasonal-edit-massage-members-*-v2.png` and add them to the "Seasonal Edit massage flyers" collection.
