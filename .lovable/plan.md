# Black Friday page: bring back payment plans, remove the account note, show months

## Why the payment plan buttons disappeared
It wasn't deliberate. When we changed Black Friday plans so buyers get the full package right away (instead of sessions added per payment), the website's plan list kept a leftover rule that only showed plans with per-payment session release. All 8 Black Friday plans now have no per-payment release, so the website stopped showing them. The plans themselves are fine, and the checkout still accepts them (staff selling already works).

## Changes
1. **Payment plans back on the website**: show the plan line ("or 3 monthly payments of $520") and the **Payment plan** button again for the 30, 40, 60 and 80-session packages, for both members and non-members.
2. **Remove the account note**: delete "You're seeing the member price for your account. Your saved card is charged, plus a payment processing fee. Packages from 30 sessions up can also be paid monthly." Signed-out visitors still see "Sign in or make an account to buy."
3. **Use-by in months**: under each package and in the checkout screens:
   - 10 sessions: 2 months
   - 20 sessions: 3 months
   - 30 sessions: 4 months
   - 40 sessions: 5 months
   - 60 sessions: 6 months
   - 80 sessions: 9 months

   The actual use-by dates on packages stay the same. 40 is really 160 days and 80 is 279 days, so the page rounds to the nearest month.

## Check
On phone and desktop, signed in as a member and as a non-member, confirm each 30/40/60/80 package shows the plan and button, opening the plan screen shows the payment breakdown, and charging stays blocked during the test. Publish afterwards.

## Technical details
- Migration: replace `pt_promo_plans` without the `pl.session_release IS NOT NULL` filter (same return shape).
- `src/pages/BlackFriday.tsx`: remove the signed-in paragraph; add `useWithinLabel(days)` = `Math.round(days/30)` months, used in the table row and both sheet texts.
