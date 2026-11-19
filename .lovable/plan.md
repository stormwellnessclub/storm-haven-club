# Wrong "member package" warning when selling a Black Friday non-member package

## What's happening
The live site still has the old Sell package screen. That version decides member or non-member only by whether the pack name starts with "Non-Member". The Black Friday non-member packs start with "Black Friday", so the old screen treats them as member packs and shows "This is a member pack, but this client is not a current member."

The fix I just made reads the pack's actual member or non-member setting instead. In the preview I picked the right Black Friday pack for each client, on phone size, and no warning appeared:
- **Non-member client, Black Friday non-member 30 sessions ($1,740):** no warning.
- **Member client, Black Friday member 30 sessions ($1,560):** no warning.
- **Wrong pack for either client:** the warning still appears, as it should.

The warning is only a reminder on screen. It doesn't block the sale.

## What to do
1. Publish so the live site gets the fixed Sell package screen. This is the only step needed. No more code changes.
2. After publishing, open Sell package with a non-member client, choose Semi-Private, and pick a pack under "Black Friday · Non-member". The warning should be gone.

## Technical details
- Cause: the published `SellPTDialog` used `isNonMemberPack` by name only. The preview version checks `promo_audience` first, and that change is already in the code.
- Nothing changes in the database or payments.
