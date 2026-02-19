

## Build Remaining Non-Member Portal Features

Three areas remain: the Stripe edge function actions for non-member card/payment management, admin "Class Support" visibility, and wiring up the portal pages to actually call those actions.

### 1. Edge Function: Add non-member actions to `stripe-payment`

**File: `supabase/functions/stripe-payment/index.ts`**

Add three new actions to the `PaymentRequest` union type and corresponding `case` blocks:

- **`create_nonmember_setup_intent`** -- Authenticated action. Calls `getOrCreateCustomer()`, then saves the `stripe_customer_id` to `non_member_profiles` (instead of `members`). Creates a `SetupIntent` with `payment_method_types: ['card']`. Logs to `card_setup_attempts` with source `'nonmember_portal'`. Returns `clientSecret` and `customerId`.

- **`sync_nonmember_card_metadata`** -- After card is saved via `confirmSetup`, the frontend calls this to fetch the default payment method from Stripe and write `card_brand`, `card_last4`, `card_exp_month`, `card_exp_year`, `stripe_customer_id` back to the `non_member_profiles` row. Also sets the payment method as the customer default via `stripe.customers.update`.

- **`list_nonmember_payment_methods`** -- Lists all card payment methods for the authenticated user's Stripe customer (looked up from `non_member_profiles.stripe_customer_id`). Returns the same format as `list_payment_methods`.

### 2. Wire up Portal PaymentMethods page

**File: `src/pages/portal/PaymentMethods.tsx`**

- Import and use `AddCardModal` (or build a simplified inline version using `@stripe/react-stripe-js` `PaymentElement`).
- On "Add Card" click: call `stripe-payment` with `action: 'create_nonmember_setup_intent'` to get `clientSecret`.
- After `confirmSetup` succeeds: call `sync_nonmember_card_metadata` to persist card details.
- Invalidate `non-member-profile` query to refresh the card display.
- Show existing card from `useNonMemberProfile` data.

### 3. Wire up Portal Recovery page with Stripe Checkout

**File: `src/pages/portal/Recovery.tsx`**

- On "Book Session" click: call `stripe-payment` with a new `create_recovery_checkout` action (or reuse existing `create_guest_payment_link` pattern) that creates a Stripe Checkout session in `payment` mode using price IDs from `STRIPE_PRODUCTS.guestAddons` (rlt20 for Red Light Therapy, cryo for Dry Cryo).
- Redirect to Stripe Checkout URL in the same tab.
- Add the `create_recovery_checkout` case to the edge function: uses `getOrCreateCustomer()`, saves customer ID to `non_member_profiles`, creates checkout session with the appropriate price ID.

### 4. Admin EmailManagement: Add "Class Support" filter

**File: `src/pages/admin/EmailManagement.tsx`**

- Add `<SelectItem value="class_support">Class Support</SelectItem>` to the category filter dropdown (after "Concierge" on line ~347).
- Add a "Class Support" badge display in the conversation list (similar to the existing "Concierge" badge on line ~421).

### 5. Admin CheckInSupportPanel: Show Class Support section

**File: `src/components/admin/CheckInSupportPanel.tsx`**

- Currently splits conversations into `concierge` vs everything else (`supportItems`).
- Add a third category: `classSupport` items filtered by `c.category === "class_support"`.
- Add a third collapsible card (green-themed, with a `BookOpen` or `GraduationCap` icon) for "Class Support" items.
- Update `supportItems` filter to exclude `class_support`: `c.category !== "concierge" && c.category !== "class_support"`.

### Technical Details

**Edge function action type update (line 69):**
Add `| 'create_nonmember_setup_intent' | 'sync_nonmember_card_metadata' | 'list_nonmember_payment_methods' | 'create_recovery_checkout'` to the action union.

**New cases added before the `default` case (~line 5675):**

```text
create_nonmember_setup_intent:
  - getOrCreateCustomer()
  - upsert stripe_customer_id into non_member_profiles WHERE user_id = auth user
  - stripe.setupIntents.create with customer
  - return clientSecret, customerId

sync_nonmember_card_metadata:
  - read stripe_customer_id from non_member_profiles
  - stripe.customers.retrieve + stripe.paymentMethods.list
  - find default or first card
  - update non_member_profiles with card_brand, card_last4, card_exp_month, card_exp_year
  - return success

list_nonmember_payment_methods:
  - read stripe_customer_id from non_member_profiles
  - stripe.paymentMethods.list
  - return formatted array

create_recovery_checkout:
  - map service name to price ID (rlt20 or cryo from STRIPE_PRODUCTS.guestAddons)
  - getOrCreateCustomer()
  - save stripe_customer_id to non_member_profiles
  - stripe.checkout.sessions.create mode:'payment', setup_future_usage:'off_session'
  - return session URL
```

**Files to modify:**
- `supabase/functions/stripe-payment/index.ts` -- 4 new action cases
- `src/pages/portal/PaymentMethods.tsx` -- Wire up add card flow
- `src/pages/portal/Recovery.tsx` -- Wire up Stripe checkout
- `src/pages/admin/EmailManagement.tsx` -- Add class_support filter option + badge
- `src/components/admin/CheckInSupportPanel.tsx` -- Add class support section

**No new files or database changes needed.**

