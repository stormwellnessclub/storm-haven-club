# Make non-member PT packs easy to find in the Sell PT Pack window

## What's going on
The six non-member packs are saved and switched on. The Sell PT Pack window does load them, but:
- They only show up when **Semi-Private** is the chosen format.
- They sit at the bottom of a long list of 14 semi-private packs, which mixes old and new packs that have nearly the same names.
- Nothing in the window marks a pack as being for members or for non-members.

## Changes
1. Split the Pack list into two labeled groups, **Member packs** and **Non-member packs**. Each pack shows its price per session, for example "Non-Member 45-Pack — $2,475 ($55/session)".
2. When the chosen client is a non-member, show the non-member packs first and pick Semi-Private as the format automatically. For members, show member packs first.
3. If you pick a different format and it has no non-member packs (One-on-One or Reformer), show a short note under the list saying non-member packs are semi-private only.
4. Warn (without blocking the sale) if a non-member pack is chosen for a member, or a member pack for a non-member.

## Technical details
- `src/components/admin/SellPTDialog.tsx`: group `formatPacks` into sections with `SelectGroup` and `SelectLabel`. A pack counts as non-member when its name starts with "Non-Member". This avoids a database change.
- Default the format to `semi_private` when the selected client's `isMember` is false.
- No changes to prices, charging, or payment plans.
