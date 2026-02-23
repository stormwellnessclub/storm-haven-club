

## Fix: Show "First Month Cash" Option More Reliably

### Problem
The "First month paid in cash" checkbox only appears when the application record has a `stripe_customer_id` set (meaning `paymentStatus?.hasCard` is true). However, many pending applications show `stripe_customer_id` as null in the database even when a card may exist in Stripe under the member's email. This hides the cash activation option.

### Fix
Relax the visibility condition so super admins always see the "First month paid in cash" option in immediate mode, regardless of whether a card is currently on file. The card-on-file requirement is not strictly necessary for the cash flow -- the admin is recording a cash payment for month 1, and the subscription can be created later once a card is added.

### Technical Details

**File: `src/components/admin/SingleActivationDialog.tsx`**

- Change the condition from:
  ```
  isSuperAdmin && activationMode === "immediate" && paymentStatus?.hasCard
  ```
  to:
  ```
  isSuperAdmin && activationMode === "immediate"
  ```
- This lets super admins see the cash option for any pending member, with or without a card on file
- The existing subscription creation logic already handles the no-card case gracefully (it skips subscription creation when there's no `stripe_customer_id`)

This is a one-line condition change.
