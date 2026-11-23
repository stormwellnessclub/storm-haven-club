# Zeinab Raishouni: 80-session PT package, $3,400 over 7 payments

## What I found
- Zeinab is a non-member with no PT package right now.
- She has 5 PT sessions showing as owed, all Semi-Private: completed sessions on Nov 10, 13, 17 and 19, plus a late cancel on Nov 14. Her other Nov 13 booking was cancelled in time and isn't owed.

## What I'll do
1. **Set up the package** using the same custom-price sale you already use in Admin → Personal Training (80 Semi-Private sessions, $3,400 total, reason "Owner-approved price"). It will expire on the same date as a regular 80-session package.
2. **Split the price into 7 monthly payments**: 6 payments of $485.71 and a final payment of $485.74, for $3,400 total. Each payment gets the usual payment processing fee, as with every other plan.
   - Payment 1 is charged today on her saved card. Payments 2 to 7 are charged automatically each month after that, and billing stops after the last one.
   - If she has no saved card, I won't charge anything. I'll stop and tell you so staff can collect the card first.
3. **Give her all 80 sessions as soon as payment 1 goes through**, the same as every payment plan since we changed it to the full package up front. Her AutoPay schedule tab will show sessions used next to sessions paid for so far.
4. **Apply her 5 owed sessions** (Nov 10, 13, 14 late cancel, 17, 19) to the new package. They'll show as paid by package, and she'll owe nothing for them.
5. **Double-check** that the package shows 75 sessions left, the payment schedule is right, and she has no PT balance owed.

No texts or emails go to her except the normal payment receipt from Stripe.

## Technical details
- Use the existing custom-sale path (sale intent with price_override_cents=340000, sessions_override=80, installment_count_override=7) so Stripe subscription schedule, webhooks and pt_build_plan_schedule_v3 handle the installments.
- After the pass exists and payment 1 succeeds, apply the 5 appointments through pt_apply_session_delta with idempotency keys, set package_deducted/pass_id/payment_status='pass' and mark the late cancel cancel_credit_outcome='consumed' (same as Ayah Abouarabi).
