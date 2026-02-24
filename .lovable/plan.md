

## Add Processing Fee to All Subscription Invoices

### The Problem

The processing fee (2.9% + $0.30) is being added to one-time checkout payments (class passes, guest passes, freeze fees, etc.) but **not** to recurring subscription invoices (monthly membership dues, annual fees). The original fix relied on the `invoice.created` webhook event, but Stripe's dashboard won't let you register that event for your endpoint.

### The Solution

Instead of relying on a webhook, we'll add the processing fee **at subscription creation time** using Stripe's `add_invoice_items` parameter. This adds a one-time "Processing Fee" charge to the subscription's first invoice. For subsequent renewals, we'll use a **recurring processing fee price** added as a second subscription item so the fee appears on every invoice automatically.

### How It Works

1. **Create a helper function** called `getOrCreateRecurringProcessingFeePrice` that:
   - Takes the base subscription price ID and billing interval (monthly/yearly)
   - Looks up the base price to get its amount
   - Calculates the processing fee (2.9% + $0.30)
   - Creates (or finds cached) a recurring price on the "Processing Fee" product matching that fee amount and interval
   - Returns the price ID to add as a second subscription item

2. **Update every `stripe.subscriptions.create` call** to include the processing fee as a second item:
   ```text
   items: [
     { price: membershipPriceId },
     { price: processingFeePriceId }   // <-- new recurring fee item
   ]
   ```

3. **Affected subscription creation points** (all in `stripe-payment/index.ts` and `stripe-webhook/index.ts`):
   - `create_subscription_from_payment` (~line 2398) - member self-activation
   - Annual fee subscription in same flow (~line 2473)
   - `admin_create_member_subscription` (~line 2656) - admin activation
   - Admin annual fee subscription (~line 2797)
   - `admin_create_initiation_fee_subscription` (~lines 4281, 4304, 4324, 4340) - initiation fees
   - `admin_create_initiation_fee_subscription_no_charge` (~line 4516)
   - Webhook annual fee subscription creation (~line 334)
   - Subscription checkout sessions (`create_activation_checkout` ~line 443, `pay_annual_fee` ~line 853, `create_member_dues_checkout` ~line 3111, `create_annual_fee_payment_link` ~line 3588) -- these use `mode: 'subscription'` checkout and don't currently include a processing fee line item

4. **For checkout sessions** (mode: subscription), we add the processing fee as an additional `line_items` entry, just like we already do for one-time checkouts.

5. **Keep the `invoice.created` webhook handler** as a safety net -- if Stripe ever starts sending those events, it will still work (it already checks for duplicate fee items).

### Technical Detail

New helper function:

```text
async function getOrCreateRecurringProcessingFeePrice(
  stripe: Stripe,
  baseAmountCents: number,
  interval: 'month' | 'year'
): Promise<string | null>
```

This creates a recurring price like:
- Product: "Processing Fee" (reuses existing product)
- Amount: calculated fee in cents
- Interval: matches the subscription interval (month or year)
- Metadata tag to enable lookup/caching

For checkout sessions, we reuse the existing `createProcessingFeeLineItem` function (which creates one-time prices) since Stripe Checkout handles the recurring billing separately via `subscription_data`.

### Files Changed

- `supabase/functions/stripe-payment/index.ts` -- add helper, update ~12 subscription creation calls and ~4 checkout session calls
- `supabase/functions/stripe-webhook/index.ts` -- update 1 subscription creation call (annual fee in checkout.session.completed handler)

### Impact on Existing Members

- **No impact** on existing subscriptions -- only new subscriptions going forward will include the processing fee item
- Existing subscriptions without the fee will continue as-is unless manually updated in Stripe

