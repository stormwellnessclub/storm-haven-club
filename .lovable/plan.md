# Fix: café and register charges going to the wrong saved card

## What's actually happening (confirmed)

The "insufficient funds" messages are real bank declines, but **we sent the charge to the wrong card**. When a member pays with a saved card, the system ignores the card they picked and ignores their main card. It always charges whichever card was **added most recently**.

Confirmed in Stripe:

| Person | Main card | Card we actually charged | Result |
|---|---|---|---|
| Zeinab Baydoun | Mastercard 1645 | Visa 6049 (newest) | 5 declines on Oct 4 |
| Nadine Dabaja | Mastercard 4166 at the time | Mastercard 4166 (newest) | 2 declines, then it went through only after she added a new Amex at 10:58 AM, which became the newest card |
| Lilian Chahrour | Amex 1008 | Apple Pay Visa 6950 (newest) | Declined at the Front Desk register and again at the café register today |

Trying again can never work for these people, because every try goes to the same declined card. Picking a different card in the café checkout makes no difference.

Lilian's register declines weren't saved in our failed-payment records, so there are probably more people affected than the records show.

## The fix

1. **Charge the card the person picked.** When the café checkout (or Shop, or spa booking) sends a chosen card, charge exactly that card. First check that the card belongs to that person.
2. **If no card was picked, charge the main card.** The Front Desk register, café register and staff charges will use the member's main card. Only if there's no main card will they use the newest one.
3. **Same rule for non-members** when no card is picked.
4. **Clearer decline message:** "Your Visa ending 6049 was declined (insufficient funds). Choose another card or add a new one." The café checkout will keep the payment window open so they can switch cards right away.
5. **Save every declined register charge**, including ones charged by Stripe customer at the Front Desk and café registers, plus non-member declines. Then failures show up in reports.
6. **Check the 3D Secure card-charge path** for the same newest-card bug and fix it if it's there.

## After the fix

- Re-check Stripe for café and register declines from the last 14 days where the card charged wasn't the main card or chosen card, and give you the list of names.
- No one gets charged again automatically. Zeinab and Lilian can re-order, or staff can ring them up, and it will go to their main card.
- Testing uses Stripe test mode only. No live charges.
- Publish is needed for the café checkout changes. The payment-side fix takes effect as soon as it's deployed.

## Technical details

- `supabase/functions/stripe-payment/index.ts`, `charge_saved_card` (around line 2256): replace `paymentMethods.list({limit:1})` with this order of choice: `body.paymentMethodId` (verify `pm.customer === customerId`, otherwise reject) → `customer.invoice_settings.default_payment_method` → newest card.
- `charge_nonmember_saved_card` fallback (around line 7694): use the default payment method before the newest card. Call `recordFailedPosCharge` on decline, and return `decline_code`, `card_last4` and `card_brand`.
- `recordFailedPosCharge`: log rows even when there's no `memberIdForLog` (register charges by `stripeCustomerId`). Resolve the member or non-member from the Stripe customer id.
- Return `card_brand`/`card_last4`/`decline_code` in decline responses. In `CafeOrderContent.tsx`, show them and keep the dialog open.
- Audit `charge_saved_card_with_3ds` for the same selection logic.
- Deploy `stripe-payment`. Run a sandbox test with a two-card customer where the default card works and the newest card declines (`pm_card_chargeDeclinedInsufficientFunds`), and confirm the charge succeeds on the default card.
