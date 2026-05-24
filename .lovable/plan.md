
## The core problem

The $300 / $175 charge is an **Initiation Fee** that recurs once a year (every member pays it, regardless of monthly vs founding). Right now three places confuse it with the monthly membership dues:

1. The bank report (`membership_dues_by_month.xlsx`) classified all "Subscription update" lines as Monthly Dues, so annual $300/$175 renewals were folded into the monthly-dues totals.
2. The member portal shows "Your annual fee renewal is coming up" on every active member's screen, year-round, even when the renewal is 11 months away.
3. The portal calls it "Annual Fee" everywhere, which reads (and was being interpreted by you) as the founding-member annual dues. We want it called **Initiation Fee** in every member-facing place and in Stripe.

## What I will change

### 1. Rebuild the bank report with correct classification

Reclassify every successful charge in `payment_attempts` (member-linked) using this priority:

1. If the row's `stripe_subscription_id` matches a member's `annual_fee_subscription_id` → **Initiation Fee**
2. Else if `stripe_subscription_id` matches the member's `stripe_subscription_id` → **Monthly Dues** (or **Annual Dues** if `is_founding_member`)
3. Fallback for backfilled rows where `stripe_subscription_id` is null:
   - Description contains "Initiation Fee" → Initiation Fee
   - Amount equals $300 / $175 (women / men, with or without the $9.27 / $5.36 processing-fee gross-up) → Initiation Fee
   - Description is "Subscription creation" / "Subscription update" → Dues (monthly or annual based on member)
   - Everything else excluded from membership totals

Re-emit `membership_dues_by_month_v2.xlsx` with three sheets, all clearly separated:

- **Monthly Dues by Month** — recurring monthly membership charges only
- **Initiation Fee by Month** — yearly $300/$175 charges (first-time and renewals together, plus a column splitting new vs renewal)
- **Charge Detail** — every row with the new classification and the rule that matched, so the bank can audit

### 2. Fix the false "annual fee renewal" notice in the portal

In `src/components/member/MemberLayout.tsx` the notice is keyed off `isInitiationFeePaid` (true for everyone), so it shows year-round. Change it to only appear when `members.next_annual_fee_date` is within 14 days and the member is not frozen. Reword to:
"Your initiation fee renews on {date} ({$amount} on card ending {last4})."

Remove the duplicate `AnnualFeeNotice.tsx` banner component or repoint it at the same date-based condition so the two cannot disagree.

### 3. Rename "Annual Fee" → "Initiation Fee" in every member-facing surface

Update copy only (DB column names like `annual_fee_subscription_id` stay — renaming them is risky and pointless since they're internal):

- `src/lib/billingTerminology.ts` — add `BILLING_TERMS.initiationFee = "Initiation Fee"` and `upcomingInitiationFee`
- `src/components/member/BillingSummary.tsx` — section title "Annual Fee" → "Initiation Fee"; "Valid until" → "Renews on"
- `src/components/member/AnnualFeeNotice.tsx` — banner text, button "Renew Annual Fee" → "Pay Initiation Fee"
- `src/components/member/ActivationRequired.tsx` — every "Annual Fee (yearly)" / "annual membership fee has already been processed" → Initiation Fee wording
- `src/components/member/PaymentDueNotice.tsx` — "Initiation Fee" already correct, just align surrounding copy
- Receipt / decline emails in `supabase/functions/stripe-webhook` and `supabase/functions/stripe-payment` — `description: "Annual Fee - {tier}"` → `description: "Initiation Fee"` and the failed-payment subscription-type label `"Initiation Fee (Annual)"` stays correct

### 4. Rename the two Stripe products

Through the Stripe API, rename:
- `prod_TibE3h9zeHNEtE` "Annual Membership Fee - Men's" → "Initiation Fee — Men's (annual)"
- `prod_TibERlMrmb3P1z` "Annual Membership Fee - Women's" → "Initiation Fee — Women's (annual)"

This changes what shows on customer receipts and the Stripe dashboard. Price IDs stay the same so no code changes are needed there. I will also add `metadata.charge_type = "initiation_fee"` on the two products so future reports can classify directly from Stripe.

### 5. Backfill `metadata.charge_type` on existing payment_attempts

One-time SQL update: for every `payment_attempts` row where the description is "Initiation Fee%" OR the amount is one of the four initiation-fee amounts ($300, $309.27, $175, $180.62), set `metadata = metadata || jsonb_build_object('charge_type','annual_fee')`. For all other member subscription rows set `'charge_type','membership_dues'`. After this, future reports can group by `charge_type` instead of inferring from amount.

## Technical notes

- DB column `next_annual_fee_date` is populated from the initiation-fee subscription's `current_period_end` in the webhook — that part is correct, so once the false banner is gated by the date, the portal will only nudge during the real 14-day window.
- Founding members: their membership dues are billed annually ($2,400–$6,000), and they also pay the $300/$175 initiation fee on a separate yearly cadence. The report will show those as "Annual Dues" and "Initiation Fee" on separate rows so they're never combined.
- No database migrations are needed for the rename (display-only).
- The Stripe product rename is done via `stripe_api_execute PostProductsProduct`, not a code change.

## Files touched

- `/mnt/documents/membership_dues_by_month_v2.xlsx` (new artifact)
- `src/components/member/MemberLayout.tsx`
- `src/components/member/AnnualFeeNotice.tsx`
- `src/components/member/BillingSummary.tsx`
- `src/components/member/ActivationRequired.tsx`
- `src/components/member/PaymentDueNotice.tsx`
- `src/lib/billingTerminology.ts`
- `supabase/functions/stripe-webhook/index.ts` (receipt descriptions only)
- `supabase/functions/stripe-payment/index.ts` (receipt descriptions only)
- One DB migration that backfills `payment_attempts.metadata.charge_type`
- Two Stripe product renames via API
