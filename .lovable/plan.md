

## Add Optional Card-on-File to Application Form (Linked to Stripe)

The skip-tour option was added, but the **optional card-on-file** section was never implemented in the application form. Currently, card collection only happens post-submission in `ApplicationUnderReview.tsx`. This plan adds it inline during the application.

### What to build

Add a new section in `Apply.tsx` between the "Alignment" section and "Agreements" section with:

1. **Checkbox**: "I'd like to add a payment method now to expedite activation if approved."
2. **When checked**: Call the existing `create_application_setup` edge function action (same one used in `ApplicationUnderReview.tsx`) to get a Stripe `clientSecret`, then render the `StripeProvider` + `PaymentElement` inline.
3. **On successful setup**: Store `payment_info_provided: true`, `stripe_customer_id`, and card metadata on the application record at submission time.
4. **If skipped**: Submit proceeds as today with `payment_info_provided: false`.

### Technical details

**File: `src/pages/Apply.tsx`**
- Add state: `addCardOnFile`, `cardClientSecret`, `cardCustomerId`, `cardSetupComplete`, `cardBrand`, `cardLast4`
- Add a new card section (Step 7, bump Agreements to Step 8) using `StripeProvider` + `PaymentElement` — reusing the exact same pattern from `ApplicationUnderReview.tsx`
- The setup intent is created via `supabase.functions.invoke("stripe-payment", { body: { action: "create_application_setup", applicantEmail, applicantName } })` — this already exists and works without authentication
- On successful `stripe.confirmSetup()`, fetch card details via `list_application_payment_methods` action and store metadata locally
- On form submit, include `payment_info_provided: cardSetupComplete`, `stripe_customer_id: cardCustomerId`, `card_brand`, `card_last4`, `card_exp_month`, `card_exp_year` in the insert payload

**File: `src/components/ApplicationProgress.tsx`**
- Add "payment" step to the steps list (optional — completion = true if skipped OR if card setup succeeded)

**No database migration needed** — `membership_applications` already has `payment_info_provided`, `stripe_customer_id`, `card_brand`, `card_last4`, `card_exp_month`, `card_exp_year` columns.

**No edge function changes needed** — `create_application_setup` and `list_application_payment_methods` actions already exist and handle unauthenticated applicants.

