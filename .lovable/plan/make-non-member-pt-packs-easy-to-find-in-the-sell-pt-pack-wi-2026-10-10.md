# Make non-member PT packs easy to find in the Sell PT Pack window

## What's going on
The six non-member packs are saved and switched on. The Sell PT Pack window does load them, but:
- They only show up when **Semi-Private** is the chosen format.
- They sit at the bottom of a long list of 14 semi-private packs, which mixes old and new packs that have nearly the same names.
- Nothing in the window marks a pack as being for members or for non-members.

## Prices (non-member = member + $5 per session)
All of these are semi-private. The prices already saved match this rule.

| Pack | Member | Non-member |
|---|---|---|
| 10 sessions | $550 ($55/session) | $600 ($60/session) |
| 20 sessions | $1,100 ($55/session) | $1,200 ($60/session) |
| 30 sessions | $1,650 ($55/session) | $1,800 ($60/session) |
| 45 sessions | $2,250 ($50/session) | $2,475 ($55/session) |
| 60 sessions | $3,000 ($50/session) | $3,300 ($55/session) |
| 80 sessions | $3,600 ($45/session) | $4,000 ($50/session) |

Not created yet, waiting on your answer: a non-member single session ($60, following the rule), and non-member versions of One-on-One and Reformer.

## How the Pack list will look
```text
Format: Semi-Private
Pack:
  MEMBER PACKS
    10 Pack     $550    ($55/session)
    20-Pack     $1,100  ($55/session)
    ...
  NON-MEMBER PACKS
    Non-Member 10-Pack  $600    ($60/session)
    Non-Member 20-Pack  $1,200  ($60/session)
    ...
```
When the client is a non-member, the Non-member group appears first.


## Changes
1. Split the Pack list into two labeled groups, **Member packs** and **Non-member packs**. Each pack shows its price per session, for example "Non-Member 45-Pack — $2,475 ($55/session)".
2. When the chosen client is a non-member, show the non-member packs first and pick Semi-Private as the format automatically. For members, show member packs first.
3. If you pick a different format and it has no non-member packs (One-on-One or Reformer), show a short note under the list saying non-member packs are semi-private only.
4. Warn (without blocking the sale) if a non-member pack is chosen for a member, or a member pack for a non-member.

## Technical details
- `src/components/admin/SellPTDialog.tsx`: group `formatPacks` into sections with `SelectGroup` and `SelectLabel`. A pack counts as non-member when its name starts with "Non-Member". This avoids a database change.
- Default the format to `semi_private` when the selected client's `isMember` is false.
- No changes to prices, charging, or payment plans.
