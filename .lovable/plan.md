# Class Pass Sale: Research and Recommendation

## What works for other studios

1. **Limited, numbered packs.** The Hundred Pilates sold a "founding-year" pack: only 8 to 10 made, never offered again, shareable, at their lowest per-class price ever. When people know it is scarce and will not come back, they buy fast, and nobody expects a discount the next season.
2. **Finish a challenge, earn a prize.** Solidcore's Solidays Challenge asks people to take 6 or 10 classes in 15 days. Everyone who hits the goal gets a prize, with no drawing, and the prize is something you can wear and cannot buy anywhere else. It was members-only, it filled classes even at off-peak times, and it set their records for sign-ups and revenue.
3. **Intro offers that lead to membership.** A "3 classes for $39–$59" style offer turns 50–65% of people into paying members when staff follow up afterward.
4. **Pricing benchmark.** Midwest reformer drop-ins run about $25. Our $25/$30 singles are right at market, so the sale should feel special without cutting our prices hard.

## Recommended sale: "The Storm Season"

A 3-week window. Members and non-members get different offers.

**Members: "Storm Season Challenge" (members only, like Solidcore)**
- Members buy a sale 8-pack at member pricing. Taking classes in the window counts toward the challenge.
- 6 classes in 21 days earns a ZeroBody or Red Light session on top of their tier.
- 10 classes earns that plus a limited Storm Wellness item that is never sold, for example a sweatshirt or grip socks. Only finishers get one.
- Progress shows on the member's portal ("7 of 10").

**Non-members: "The Numbered Pack" (scarcity, like The Hundred)**
- Only 25 packs, numbered (#01 to #25), sold online until they run out.
- 5 classes plus one wet spa day, so they get a taste of the whole club.
- If they join within 30 days, what they paid comes off their first month.
- The page shows "X of 25 left".

Why it fits: members get a goal and a prize instead of a wet spa perk they already have. Non-members get a reason to buy now and an easy step into membership. Neither offer lowers our everyday prices.

## What I would build (after you approve and confirm prices and dates)

1. Sale settings in Admin: dates, prices, pack limit, and prize levels.
2. Two sale packs for sale on the Classes page and in the portal, with member and non-member prices kept separate.
3. A "packs left" counter that stops selling at the limit.
4. A challenge progress bar on the member portal, plus a staff list of who reached each level, so the front desk can hand out prizes.
5. Membership credit for non-member pack buyers who join within 30 days, shown to staff when they approve the application.
6. An email preview for the launch announcement. Nothing gets sent until you approve it.

## Decisions needed from you
- Prices: member 8-pack, and the non-member Numbered Pack
- Sale dates and pack limit (25 suggested)
- The finisher item (sweatshirt, socks, tote)

## Technical details
- Use the existing class pass prices table with the audience field (member or non-member), and add a sale window and pack limit.
- Count classes toward the challenge from attended bookings inside the window, using Detroit time.
- The recovery reward is added as a normal credit for that member.
- All payments use the existing checkout. Testing uses Stripe test mode only, with no emails to real clients.
