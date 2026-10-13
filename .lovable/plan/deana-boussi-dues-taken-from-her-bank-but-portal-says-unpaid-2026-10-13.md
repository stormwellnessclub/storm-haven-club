# Deana Boussi: dues taken from her bank but portal says "Unpaid"

## What actually happened (checked in Stripe and our records)
- Her Oct. 4 dues ($200, Silver Women's Monthly) were first tried on her Visa debit ending 8870 and declined (insufficient funds).
- On Oct. 8 Stripe then charged her Bank of America checking account ending 4258. Her bank released the money, but bank transfers take a few business days to clear, and Stripe still shows that payment as **pending**.
- Until it clears, the Stripe bill stays "open", so our system still marks her as owing $200 / past due. That's why her portal says Unpaid. She isn't being charged twice.
- When the bank payment clears, Stripe tells our system and her portal will switch to Paid on its own. If the bank rejects it, it stays unpaid.

## What to change so this doesn't confuse members
1. When a dues payment from a bank account is still clearing, the member portal shows **"Payment processing — your bank payment is on its way"** and doesn't say "Unpaid" or show a pay button.
2. In admin and at the front desk, that member shows a "Bank payment clearing" label instead of "Past due". They aren't blocked at check-in while it clears. If the bank rejects the payment, the normal past-due blocks come back.
3. For Deana now: mark her as "payment clearing" so she can check in. Nothing gets charged and no email is sent.

## Suggested reply to Deana
"Hi Deana, thanks for reaching out! Your payment came from your bank on Oct. 8 and is still clearing, which takes a few business days. Your portal will update to paid on its own once it goes through. Nothing else is needed from you, and you won't be charged twice."

## Technical details
- Record the pending payment on the dues row in our records. Do this from the Stripe events for a bank payment that is processing, succeeds, or fails.
- The member portal, the admin billing-issues list and the check-in eligibility check all treat "processing" as not past due.
- Run a one-time check on open dues bills that have a bank payment still clearing (Deana first). No changes to Stripe.
