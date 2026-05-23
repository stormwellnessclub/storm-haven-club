## Problem
The current report counts ANY successful Stripe charge as a "payment," which is wrong:
- Jenna Saleh's $16.99 (cafe/other) was counted instead of her real Gold dues
- Duha's $204 was a massage package, not membership
- Other members (Jeree, etc.) who legitimately owe dues are being marked as paid because of unrelated charges (spa, cafe, class passes, guest passes)

## Fix
Only count charges that are **membership monthly/annual dues** — nothing else.

### How to identify a dues charge
A Stripe charge counts as "dues paid" for a window ONLY if it meets one of these:
1. It originated from a Stripe **invoice** tied to a **subscription** whose price ID is in the membership dues price list (`STRIPE_PRODUCTS.memberships.*.monthly.*` and `.annual.*`), OR
2. It is a **manual_charge** in our DB explicitly tagged as `monthly_dues` / `annual_dues` (catch-up charges).

Everything else is excluded: annual facility fee, class passes, guest passes, spa/massage, cafe, kids care, merch, initiation, tips, POS, manual charges with other descriptions.

### Special cases
- **Duha**: exclude from the report entirely (not an active dues-paying member per user).
- **Founding members**: still treated as PAID across all 3 windows (annual upfront).
- **Frozen members**: only flagged frozen for the specific window(s) covered by an approved freeze AND where no dues invoice was paid.

## Implementation
1. Update `supabase/functions/missed-payments-report/index.ts` to:
   - Pull invoices (`/v1/invoices?customer=...&status=paid`) instead of raw charges
   - For each paid invoice, check `subscription` is set and `lines.data[].price.id` is in the membership dues price ID set
   - Return per-member: which dues invoices hit each of the 3 windows + amount + invoice id for audit
2. Hard-code the dues price ID allowlist in the edge function (copied from `src/lib/stripeProducts.ts` `memberships.*.monthly` + `.annual`, excluding `annualFee`).
3. Update `/tmp/build_missed.py` to:
   - Drop Duha from the active list
   - Use the new dues-only data
   - Add an **Audit** column showing the Stripe invoice ID + amount that satisfied each window, so you can spot-check
4. Regenerate `/mnt/documents/members_missed_payments_v3.xlsx` with:
   - **Owe Money (Monthly)** — rows sorted by months owed desc, with invoice IDs per window
   - **Founders (Paid Annual)** — unchanged
   - **Frozen (Not Owed)** — recomputed against dues-only
   - **Summary** — corrected counts
   - **Excluded** — explicit list (Duha + the 7 accidental applies) with reason

## Verification before delivery
Spot-check 3 names you mentioned by listing their actual dues invoices per window in the Audit column:
- Jenna Saleh — expect Feb/Mar/Apr/May dues invoices (PAID all)
- Jeree — expect missing window(s) flagged
- Duha — not present (excluded)

## Question
Do you want me to also include **Annual Fee** ($300 women / $175 men) as a separate "paid" check, or keep the report strictly about monthly/annual membership dues? My recommendation: dues only, since the annual fee is yearly and won't fall in these specific monthly windows for most members.
