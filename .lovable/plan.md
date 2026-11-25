# Let a PT plan's first payment start on a later date, then sell Linda's and Latife's packages

## Answer: Latife's current package
- Her last payment is **June 1, 2027**. That's payment 8 of 8, at $450 each.
- She has **47 sessions left** out of 80. She has used 33.
- Her package expires May 7, 2027.

## 1. New option: "First payment on a later date"
Right now a payment plan always charges payment 1 on the day of the sale. I'll add an option to the staff PT sale, and the matching admin step, so that:
- Nothing is charged today. Payment 1 is charged automatically on the date you pick, then the rest follow monthly.
- The Seasonal Edit price is locked in on the day of the sale, even though she pays later.
- The new package is created now with a future start date, so sessions can't be booked before it starts.
- If payment 1 fails on its date, it goes through the usual failed-payment tracking, and you see it like any other missed PT payment.
- Stripe and reports label each payment as the package name, "payment X of Y".

## 2. Linda Hakim (non-member)
- Seasonal Edit 80 Semi-Private: $3,800, 4 payments of $950 ($978.68 each with the payment processing fee)
- Amex ending 2003. Payment 1 on **Jan 24, 2027** (the same day as her current plan's last payment), then Feb 24, Mar 24 and Apr 24
- Package starts Feb 1, 2027 and expires Nov 7, 2027

## 3. Latife Alsayed (active member)
- Seasonal Edit 80 Semi-Private member price: $3,360, **7 payments of $480** ($494.64 each with the fee)
- Card: the one her current plan uses
- Payment 1 on **June 1, 2027** (her current plan's last payment day), then monthly through Dec 1, 2027
- Package starts when her current one ends: **May 8, 2027**, and expires 279 days later (Feb 11, 2028)
- Tell me if she wants a different number of payments or a different start date

No texts or emails are sent to anyone. Their current packages stay exactly as they are.

## Technical details
- `admin-create-pt-payment-plan`: add `deferFirstPayment` (staff manager+ only). When set, amount due today is 0, no PaymentIntent is created, and the Stripe subscription schedule starts at `firstAutopayDate` with all N installments. Installment 0 is stored as scheduled, not due_now. The sale intent and package are finalized without a payment, with `activated_at` in the future. Add a matching toggle in `SellPTDialog`.
- Sessions stay unbookable until `activated_at`, using existing activation checks. Verify this before selling.
- Tests: deferred schedule builds N installments starting on the chosen date, with $0 due today. Rolled-back DB test with no real charge.
- Record the rule in `supabase/functions/AGENTS.md`.
