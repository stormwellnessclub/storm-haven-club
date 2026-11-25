# New 80-session Semi-Private plans for Elizabeth McVicar and Linda Hakim

Both use the Seasonal Edit 80 Semi-Private price. Every payment gets its own payment processing fee: (amount + $0.30) / (1 - 0.029). All sessions go on the account at sale, as with the other Seasonal Edit plans. No texts or emails.

## Elizabeth McVicar (active member)
- Price: $3,360 (Seasonal Edit member), 7 monthly payments of $480
- Each payment with fee: $494.64 (total $3,462.48)
- Card: Visa ending 7958
- Payment 1 charged today (Nov 25). Payments 2 to 7 on the 25th of each month, Dec 25 through May 25, 2027
- Package starts Feb 1, 2027 and expires Nov 7, 2027 (279 days from start)
- If today's charge is declined, nothing is created and I'll tell you

## Linda Hakim (non-member)
- Price: $3,800 (Seasonal Edit non-member), 4 payments of $950 (her own split)
- Each payment with fee: $978.68 (total $3,914.72)
- Card: Amex ending 2003 (her current plan's card)
- Nothing charged today. Payment 1 on Jan 24, 2027, the same day as her current package's last payment. Then Feb 24, Mar 24 and Apr 24
- Package starts Feb 1, 2027 and expires Nov 7, 2027
- Her current package (59 sessions left, payments on Nov 24 cash, Dec 24 and Jan 24) stays as it is
- The Seasonal Edit price is locked in now, before the Nov 30 cutoff, even though she pays later

## Technical details
- Staff sale path (pt_open_sale_intent_v2 with custom plan, admin-create-pt-payment-plan) with activation 2027-02-01 and expiry 2027-11-07.
- Linda: first installment date 2027-01-24, $0 due today. If the sale tool requires a payment today, I stop and ask before charging anything.
- Elizabeth's member record already links to her Stripe customer that holds card 7958.
- Read both back afterward: sessions, schedule, card, dates.
