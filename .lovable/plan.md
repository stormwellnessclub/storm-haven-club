# Sell PT package: sort Black Friday member and non-member prices into their own groups

## What's wrong
On the staff "Sell PT package" screen, the pack list sorts packs into "Member packs" and "Non-member packs" by checking whether the pack name starts with "Non-Member". All 12 Black Friday packs start with "Black Friday", so every one of them, member and non-member, lands under "Member packs", mixed together in pairs (10 member, 10 non-member, 20 member...).

## What you'll see after the fix
When Semi-Private is chosen, the pack list has four clear groups:

```text
Black Friday · Member        10 / 20 / 30 / 40 / 60 / 80 sessions
Black Friday · Non-member    10 / 20 / 30 / 40 / 60 / 80 sessions
Member packs                 regular prices
Non-member packs             regular prices
```

- The groups that match the selected client come first. A member sees the Black Friday member group at the top, and a non-member sees the Black Friday non-member group at the top.
- Each group is sorted from fewest to most sessions.
- The Black Friday names in the list are shortened to "30 sessions — $1,560.00 ($52/session)", because the group heading already says Black Friday and member or non-member.
- The existing warning still appears if staff pick a pack for the wrong kind of client. It now also works for Black Friday packs.
- Black Friday groups disappear on their own when the offer ends (Cyber Monday, Nov 30, 11:59 PM Detroit).

## Not changing
Prices, payment plans, checkout and the public Black Friday page stay as they are.

## Technical details
- `src/components/admin/SellPTDialog.tsx`: decide the audience with `promo_audience` when it's set, and fall back to the "Non-Member" name check otherwise. Build the groups as promo-member, promo-non-member, member, non-member, ordered by `clientIsMember`. Sort each group by `sessions`. Hide promo packs whose `sale_ends_at` has passed (or before `sale_starts_at`) using the existing `saleHasEnded` helper. `packAudienceMismatch` uses the same audience function.
- Verify in the browser at phone and desktop widths: open Sell PT package, choose Semi-Private, and check the group order for a member client and for a non-member client.
