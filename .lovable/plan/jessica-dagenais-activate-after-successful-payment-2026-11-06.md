# Jessica Dagenais: activate after successful payment

## What I found
- Her first dues charge ($2,471.99, annual Silver) was declined on Nov 4 for insufficient funds.
- She paid it through the member retry on Nov 5 at 1:41 PM. Billing now shows active, and her annual fee was paid.
- Her membership still says "pending activation". The system has a rule that billing never activates a member: activation is always a staff decision. So the payment going through did not activate her, and nobody was told it was ready.

## Steps
1. Check in Stripe that the Nov 5 invoice is fully paid, with no refund or dispute.
2. Check her other activation steps: waiver signed and card on file. Her activation deadline is Nov 12.
3. If everything checks out, activate her through the usual staff activation, which sets her start date and turns on her benefits. She gets the normal welcome email and nothing else.
4. Stop this from happening again: when a pending member's first payment goes through on a retry, show a "Payment received — ready to activate" alert on the Applications/Members screen. Staff still make the activation decision.

## Technical details
- Step 3 uses the existing approval/activation path, not `apply_billing_status_change`, so the billing rule stays the same.
- Step 4: the payment-success handler (webhook / `charge-member-arrears` retry) flags pending_activation members with a paid subscription, and the admin view lists them. I'll add a small test for that flag.
