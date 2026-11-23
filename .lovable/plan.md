# Show members how their discount is applied, and make the member flyers clearer

## The answer today
When a member books a massage or spa service, the price is discounted for them automatically. They see the regular price crossed out, the lower price, and the words "Member Price". They don't see which discount was used or how much it saved them.

## 1. Spa and massage booking: show the discount step by step
When a member books, the price box will show:

```text
Storm Signature Massage · 60 min      $155.00
Gold member discount (8%)            − $12.40
Your price                            $142.60
```

- This appears wherever a member books a spa service: massages, wraps, facials and Aella services.
- It shows their own membership level (Silver 5%, Gold 8%, Platinum 10%, Diamond 12%) and the dollar amount saved.
- Member credits keep showing "Covered" as they do today.
- Non-members see one price, as they do now.

## 2. Massage gift page: same breakdown for members
When a signed-in member picks a massage gift, they'll see:
- The Seasonal Edit gift price
- "Gold member discount (8%)" with the dollar amount saved
- Their final price

This replaces the short note they see now.

## 3. Member massage flyers, version 2
The current member flyers only list the discount percentages, so members can't tell what they'd actually pay. The new set will:
- Show each massage's price for every membership level. For example, the 60-minute Signature is $114 Silver, $110.40 Gold, $108 Platinum and $105.60 Diamond.
- Say "Your member discount comes off automatically and shows at checkout."
- Keep the same three designs (dark brown list, card on towels, envelope on velvet).
- Be saved as new versions next to the current ones, so nothing is replaced. They'll be ready for the member email campaign.

## Not in this plan
- The body wrap offer, wet spa access for the non-member spa offer, and members buying gifts for non-members. These still need your answers to the three questions I asked earlier. I'll ask them again after this.
- Prices and booking rules don't change. Only what members see changes.

## Technical details
- `src/components/booking/SpaBookingModal.tsx`: replace the inline tier math with `memberTierRate` from `src/lib/spaPackages.ts`. Render the regular price, a discount line with the tier label, percent and dollar savings, and the final price.
- Check any other member spa price displays (Aella checkout, package purchase) and use the same breakdown component (`MemberDiscountBreakdown`).
- `src/pages/GiftCardStore.tsx`: show the breakdown for the selected massage gift.
- Flyers: regenerate with the existing flyer generator as `seasonal-edit-massage-members-*-v2.png` and add them to the "Seasonal Edit massage flyers" collection.
- Add a test for the breakdown math (savings and final price for each tier).
