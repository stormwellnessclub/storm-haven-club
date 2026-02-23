

## Add "Processing Fee" to All Payment Flows (Including Recurring Subscriptions)

### What This Does

Every charge -- one-time and recurring -- will include a transparent **"Processing Fee"** line item covering Stripe's 2.9% + $0.30 per transaction. The customer sees this as a separate line before paying, and on every invoice.

### Fee Formula

```text
total = ceil((base_amount_cents + 30) / 0.971)
processing_fee = total - base_amount_cents
```

This ensures the club receives exactly the base amount after Stripe deducts its fee.

---

### Changes Overview

#### 1. Create Shared Fee Utility (Frontend)

**New file:** `src/lib/processingFee.ts`

A small helper used by all frontend components to display the fee before checkout:

```text
calculateProcessingFee(amountInCents) --> feeInCents
calculateProcessingFeeFromDollars(dollars) --> feeDollars
```

#### 2. Add Fee to Stripe Checkout Sessions (Edge Function)

**File:** `supabase/functions/stripe-payment/index.ts`

For every checkout action that creates a Stripe Checkout Session, add a second line item for the processing fee:

- `create_activation_checkout` -- membership signup
- `create_class_pass_checkout` -- class pass purchase
- `create_guest_pass_checkout` -- guest pass
- `create_guest_pass_experience_checkout` -- guest pass with add-ons
- `create_freeze_fee_checkout` -- freeze fee
- `create_recovery_checkout` -- non-member recovery

The fee line item uses an ad-hoc Stripe Price created with `stripe.prices.create()` tied to a reusable "Processing Fee" product. The product is looked up (or created once) at the start of the function.

#### 3. Add Fee to Recurring Subscription Invoices (Webhook)

**File:** `supabase/functions/stripe-webhook/index.ts`

Add a new handler for the **`invoice.created`** event. When Stripe generates a draft invoice for a subscription renewal:

1. Calculate the processing fee on the invoice subtotal
2. Add an invoice item via `stripe.invoiceItems.create()` with description "Processing Fee"
3. This happens before Stripe finalizes and charges the invoice

This covers monthly membership dues, annual fees, and any other recurring subscription charges automatically.

**Important:** The webhook must also be configured in the Stripe Dashboard to send `invoice.created` events (it currently only sends `invoice.payment_succeeded`, `invoice.payment_failed`, and `invoice.payment_action_required`).

#### 4. Add Fee to Direct/Admin Card Charges

**File:** `supabase/functions/stripe-payment/index.ts`

For actions that charge a saved card directly:

- `charge_saved_card` -- admin one-off charges
- `charge_saved_card_with_3ds` -- 3DS-required charges
- `charge_annual_fee` -- annual/initiation fee charges

The edge function will:
1. Calculate the processing fee on the requested amount
2. Add the fee to the total charge amount
3. Update the description to include "(includes $X.XX processing fee)"
4. Store the fee breakdown in the payment intent metadata

#### 5. Show Fee in Frontend Components

Update these components to display the fee as a separate line item before the customer confirms:

| Component | What It Shows |
|-----------|--------------|
| `CafePOSCart.tsx` | Processing fee line between tax and total |
| `MembershipActivationPayment.tsx` | Fee line below the membership amount |
| `SpaBookingModal.tsx` | Fee line in the booking summary |
| `ClassPasses.tsx` | Fee note on pricing cards |
| `GuestPass.tsx` | Fee line in checkout summary |
| `ChargeItemSelector.tsx` | Fee preview when admin selects charge amount |

---

### Files to Create

| File | Purpose |
|------|---------|
| `src/lib/processingFee.ts` | Shared fee calculation for frontend display |

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/stripe-payment/index.ts` | Add fee calculation to all checkout and direct charge actions |
| `supabase/functions/stripe-webhook/index.ts` | Add `invoice.created` handler to inject fee into recurring invoices |
| `src/components/admin/CafePOSCart.tsx` | Show processing fee line item |
| `src/components/member/MembershipActivationPayment.tsx` | Show fee in payment summary |
| `src/components/booking/SpaBookingModal.tsx` | Show fee in booking total |
| `src/pages/ClassPasses.tsx` | Show fee note on pricing |
| `src/pages/GuestPass.tsx` | Show fee in checkout flow |
| `src/components/admin/ChargeItemSelector.tsx` | Show fee preview for admin charges |

### Stripe Dashboard Action Required

After deployment, add **`invoice.created`** to the webhook endpoint's event list in the Stripe Dashboard. Without this, the processing fee will not be added to recurring subscription invoices.

### No Database Changes Needed

Fee data is stored in Stripe metadata and invoice line items. No new tables required.

