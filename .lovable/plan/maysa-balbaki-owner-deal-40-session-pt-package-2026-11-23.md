# Maysa Balbaki: owner deal, 40-session PT package

## The math
- 40-session member package: $1,880
- Dues already paid and counted: Sept $160 (from Sept 15) + Oct $200 + Nov $200 = $560
- **PT balance at the start: $1,320**
- Charged now: $920. **Balance after that: $400**
- Dec 9 dues paid: $400 − $200 = $200
- Jan 9 dues paid: $200 − $200 = **$0, paid in full**

## What I'll set up
1. **Sell her the 40-session member package at a custom price of $1,320.** The reason on the sale will say: "Owner deal: Sept 15 to Nov membership dues ($560) applied; Dec and Jan dues apply as paid."
2. **Set it up as a 3-part plan:**
   - Part 1: **$920 charged to her card on file**, only after you approve. First I'll check that she has a working card on file. If she doesn't, I'll stop and tell you.
   - Part 2: $200, covered by her **Dec 9** dues payment
   - Part 3: $200, covered by her **Jan 9** dues payment
   Parts 2 and 3 are never charged as PT. Her card is charged only through her normal dues.
3. **Automatic check after each dues day.** On Dec 10 and Jan 10, the system checks once whether that month's dues payment went through. If it did, that $200 part is marked paid and comes off her PT balance. Each check runs once and then removes itself.
4. **If a dues payment fails,** that $200 stays on her PT balance as owed, and you'll see it on her profile. Once the dues payment succeeds later, the next check marks it paid. Nothing is charged to her card for it on the PT side.
5. **Take her 18 used sessions off the package** (17 completed plus the Nov 17 late cancel). Her $990 unpaid PT balance clears, and **22 sessions are left**. Tomorrow's session (Nov 24) comes off after it happens, the normal way.
6. **Her membership keeps billing as usual.** Nothing about her dues changes.

## What she'll see
- Portal: a 40-session package with 22 sessions left, plus the 3 payments with their dates. Dec and Jan are labeled "covered by membership dues."
- One $920 PT charge, labeled with the package name.

## What won't happen
No refunds, no messages from us (Stripe may send its normal receipt), and no other members or records changed.

## Technical details
- Custom-price sale via the existing manager override path, with installment_count_override = 3 and custom installments ($920 now, $200 Dec 10, $200 Jan 10). The two later installments are flagged as dues-covered, so they never create a Stripe charge.
- Two one-time self-removing timers (Dec 10, Jan 10, Detroit time) check her dues invoice status in Stripe and run the existing service-role bookkeeping to mark the installment paid. Reports keep reading revenue_ledger, so the dues are counted once, as dues.
- Sessions are applied with the same package-consumption path used for Ayah and Zeinab.
