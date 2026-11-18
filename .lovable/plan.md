# Black Friday PT packages: sale page, email and text

## Settled
- All deals end **Mon Nov 30, 11:59 PM (Detroit time)**.
- Each deal can have its own start date, so some can begin early.
- PT is done first. Class and spa deals get added to the same sale page later.
- Packages are **Semi-Private** training. Member and non-member prices:

| Package | Member | Non-member |
|---|---|---|
| 10 sessions | $520 | $580 |
| 20 sessions | $1,040 | $1,160 |
| 30 sessions | $1,560 | $1,740 |
| 40 sessions | $1,880 | $2,120 |
| 60 sessions | $2,820 | $3,150 |
| 80 sessions | $3,360 | $3,800 |

## Start date
- The PT deals go on sale as soon as the page is published. Tell me if you'd rather pick a different start date.

## What gets built
1. **Black Friday PT packages.** These are sale-only packages with the prices above. Members see the member price. Everyone else, including cancelled members, sees the non-member price. They show up only between the start date and Nov 30, 11:59 PM, then hide automatically. Regular packages and existing balances stay as they are.
2. **Black Friday sale page** on the website. It follows the photo-led editorial style and the brand voice, and never uses the word "free". It has a PT section now, with room for class and spa deals later. Each deal shows its end date. Once a deal ends, its section shows "This offer has ended".
3. **Buying.** People can buy online with the card checkout they already use. Each package gets a clear Stripe label, for example "Black Friday Semi-Private PT – 20 Sessions (Member)", plus 6% Michigan tax. When payment goes through, the sessions are added to the client's PT balance automatically.
4. **Email and text** from Campaign Studio. I'll show you the exact wording and the audience first, and nothing is sent until you approve. Texts go only to people who agreed to receive them, and every email has an unsubscribe link.

## Checks
- Small tests confirm each price, member vs. non-member pricing, and that sales stop after Nov 30, 11:59 PM.
- I'll do a test purchase on the preview without charging a real card.

## Technical details
- Add the packages as PT package templates with sale start and end times. Pricing uses the existing member-status check, which treats cancelled members as non-members.
- Stripe fulfillment goes through the existing PT package purchase path. Revenue reports keep using only the revenue ledger.
