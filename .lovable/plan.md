
## Fix: Declined Payments Visibility and Admin Actions

### Problem Summary
Three interconnected issues prevent you from managing members with declined payments:

1. **Failed Payments tab shows nothing** -- The `payment_attempts` table is empty (webhooks haven't recorded any failed attempts yet, likely because the subscriptions failed on the initial invoice before the webhook was configured). The Failed Payments tab ONLY queries this table, so it shows "No failed payments."

2. **No Retry Dues button** -- There is no "Retry Invoice" or "Retry Payment" action in the admin UI or the backend function. You cannot re-attempt a failed subscription payment.

3. **No quick Deactivate action** -- While you can manually change a member's status via Edit, there is no dedicated "Mark Inactive" or "Suspend" button visible for members with payment issues.

### Currently Affected Members (10 total)
- Deana Boussi (pending_activation / incomplete)
- Wafaa Diab (active / incomplete)  
- Zahna Abdallah (past_due / past_due)
- Nadine Elachkar, Walaa Hachem, Rayanne Haidar, Jacquelyne Olson, Lara Sabra, Jessica Seagull, Kinda Turaani (pending_activation / incomplete)

---

### Fix 1: Show Members with Billing Issues in Failed Payments Tab

The Failed Payments tab currently only queries `payment_attempts` (which is empty). Add a secondary data source that queries members directly where `subscription_status` is `incomplete`, `incomplete_expired`, or `past_due`.

**File**: `src/hooks/usePaymentTracking.ts`
- Add a new hook `useMembersWithBillingFailures()` that queries the `members` table for `subscription_status IN ('incomplete', 'incomplete_expired', 'past_due')`
- Return member name, email, tier, status, subscription_status, card info, and stripe_subscription_id

**File**: `src/components/admin/FailedPaymentsTab.tsx`
- Add a "Members with Billing Issues" section above or alongside the existing payment_attempts table
- Show these members in a table with columns: Name, Tier, Status, Subscription Status, Card on File, Actions
- Actions include: Retry Payment, Suspend Member, View Profile

---

### Fix 2: Add "Retry Invoice" Backend Action

**File**: `supabase/functions/stripe-payment/index.ts`
- Add a new action case `retry_subscription_invoice` that:
  1. Looks up the member's `stripe_subscription_id`
  2. Retrieves the subscription from Stripe
  3. Finds the latest open/unpaid invoice (`stripe.invoices.list({ subscription: subId, status: 'open' })`)
  4. Calls `stripe.invoices.pay(invoiceId)` to retry payment
  5. Returns success/failure with details

---

### Fix 3: Add Admin Actions to Member Detail and Failed Payments

**File**: `src/components/admin/MemberDetailSheet.tsx`
- Add a prominent "Payment Failed" alert banner when `subscription_status` is `incomplete` or `past_due`
- Add "Retry Payment" button that calls the new `retry_subscription_invoice` action
- Add "Deactivate Member" button that sets status to `suspended` and optionally cancels the Stripe subscription
- These buttons appear in the Billing tab when payment issues are detected

**File**: `src/components/admin/FailedPaymentsTab.tsx`  
- Add inline action buttons per row: "Retry", "Suspend", "View"
- Add a bulk action option to suspend all members with failed payments

---

### Fix 4: Sync Subscription Status from Stripe

**File**: `supabase/functions/stripe-payment/index.ts`
- Add a `sync_member_subscription_status` action that:
  1. Fetches the member's subscription from Stripe
  2. Gets the latest invoice status
  3. Updates `subscription_status` in the members table
  4. Inserts a record into `payment_attempts` if a failure is found
- This allows admins to manually sync status for members whose webhooks were missed

**File**: `src/components/admin/FailedPaymentsTab.tsx`
- Add a "Sync All from Stripe" button at the top that triggers sync for all members with subscriptions

---

### Summary of Changes

| File | Change |
|------|--------|
| `supabase/functions/stripe-payment/index.ts` | Add `retry_subscription_invoice` and `sync_member_subscription_status` actions |
| `src/hooks/usePaymentTracking.ts` | Add `useMembersWithBillingFailures()` hook querying members with bad subscription_status |
| `src/components/admin/FailedPaymentsTab.tsx` | Add "Members with Billing Issues" section, inline Retry/Suspend actions, Sync button |
| `src/components/admin/MemberDetailSheet.tsx` | Add payment failure alert banner with Retry and Deactivate buttons |

### Technical Notes
- The `payment_attempts` table is empty because these subscriptions failed on the initial invoice (before the webhook could fire a `payment_failed` event). The fix addresses this by also querying member subscription_status directly.
- The Stripe API `invoices.pay()` will retry charging the customer's default payment method for the open invoice.
- The sync action acts as a manual recovery tool for missed webhooks.
