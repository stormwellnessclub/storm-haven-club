

## Add "Cancel Membership" Button to Member Detail Page

### Problem
The Member Detail page has no dedicated "Cancel Membership" action button. Currently, the only way to cancel a member is to edit their profile and manually change the status dropdown to "cancelled." There's no streamlined workflow that also handles Stripe subscription cancellation and sends the cancellation notice email.

### Solution
Add a "Cancel Membership" button to the action toolbar on the Member Detail page, with a confirmation dialog that:
1. Cancels the member's Stripe subscription (if one exists)
2. Sets the member status to "cancelled"
3. Optionally sends the appropriate cancellation email
4. Logs the action for the 24-hour undo window

### File to Change

**`src/pages/admin/MemberDetail.tsx`**

1. Add a "Cancel Membership" button in the action toolbar (next to Suspend/Delete), visible when the member status is NOT already "cancelled"
2. Add a confirmation dialog with:
   - Warning about what cancellation does (revokes access, cancels billing)
   - Checkbox option: "Send cancellation notice email" (checked by default)
   - Cancel and Confirm buttons
3. Add a `handleCancelMembership` function that:
   - Calls `stripe-payment` with `action: "deactivate_member"` to cancel the Stripe subscription (if `stripe_subscription_id` exists)
   - Updates the member status to `"cancelled"` in the database
   - Sends the appropriate cancellation email template (auto-detected based on payment history)
   - Logs the action to `admin_action_log` for undo support
   - Refreshes the member data

### Button Placement
The button will appear in the existing action toolbar alongside Suspend/Delete, using a destructive outline style with a `Ban` icon to differentiate it from Suspend (`XCircle`).

### Technical Details

- New state variables: `showCancelDialog`, `isCanceling`, `sendCancelEmail` (checkbox)
- The cancellation email template is auto-selected:
  - No `annual_fee_paid_at` and no `stripe_subscription_id` --> `application_cancelled`
  - Has `annual_fee_paid_at` but no `stripe_subscription_id` --> `incomplete_membership_cancelled`
  - Has both --> `membership_cancelled`
- Stripe subscription cancellation uses the existing `deactivate_member` action in the `stripe-payment` edge function
- The "Send Cancellation Notice" button (currently visible only for already-cancelled members) will remain as-is for re-sending notices
