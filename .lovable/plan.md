

# Block Enforcement Gaps for Sarah Siddiqui

## Current State

Sarah **is** in the `blocked_persons` table. The block check currently works in:
- **ProtectedMemberRoute** — shows AccessRevoked
- **ProtectedPortalRoute** — shows AccessRevoked
- **QR scanner RPCs** — returns `access_revoked`

## Gaps Found

The block list is **not enforced** in these critical areas:

1. **Stripe payment edge function** — A blocked person can still initiate payments, subscriptions, or purchases. No block check before processing.
2. **Auth flow** — A blocked person can still sign up or log in. They only get blocked after reaching a protected route. They can still access the auth page and public pages.
3. **Application submission** — A blocked person could submit a new membership application.
4. **Webhook processing** — If a blocked person somehow has an active subscription, the webhook will still process their payments.

## Plan

### 1. Add block check to `stripe-payment` edge function
Before processing any payment action (`create_subscription`, `create_checkout`, `add_processing_fees`, etc.), query `blocked_persons` by email and reject with a clear error if blocked.

### 2. Add block check to the Auth page
After login/signup, check if the user's email is in `blocked_persons`. If so, immediately sign them out and show an "Access Denied" message. This prevents them from even getting a session.

### 3. Add block check to application submission
In the membership application flow, check the block list before allowing form submission.

### 4. Add block check to `stripe-webhook` edge function
When processing `invoice.payment_succeeded` or `customer.subscription.created`, check if the customer email is blocked. If so, refund the payment and cancel the subscription automatically.

### Technical Details

- All edge function checks will query `blocked_persons` table using the Supabase service role client
- Auth page check will use the existing `useBlockedStatus` hook post-login, then call `signOut()` if blocked
- Application form will do a pre-submit check against the `is_email_blocked` RPC (already exists in the database)

