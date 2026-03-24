

# Fix: Check-In Still Approving Members With Past Due / Missing Payments

## Root Cause Analysis

There are **three distinct bugs** all contributing to the same visible problem:

### Bug 1: Client-side billing check ignores `subscription_status = 'past_due'`
`useMembersBillingIssues.ts` only flags `subscription_status` values of `incomplete` and `incomplete_expired`. It completely ignores `past_due`. Kaitlin Mault has `subscription_status: 'past_due'` but zero `payment_attempts` records, so the client thinks she's clean and shows "Check-In Approved."

### Bug 2: Backend RPC doesn't block members with no subscription at all
The `process_member_scan` function in the database only checks `subscription_status` IF `stripe_subscription_id IS NOT NULL`. For Sherene (and anyone else whose dead subscription was cleared), `stripe_subscription_id` is NULL, so the subscription check is completely skipped. She gets access granted because her `status` is still `active`.

### Bug 3: The migration from earlier was not applied (or was overwritten)
The current `process_member_scan` in the database is an older version that does not include the billing-block logic, the `is_billing_block` flag, the `payment_attempts` check, or the no-subscription guard. The function currently running is the simple version that only checks `status` and optionally `subscription_status` when a subscription ID exists.

### Architectural weakness
The client (`getEffectiveStatus`) and server (`process_member_scan`) make independent access decisions using different data and different rules. The UI shows "Check-In Approved" or "Cannot Check In" before calling the backend, creating conflicting signals when they disagree.

---

## Implementation Plan

### 1. Fix the backend RPC — replace `process_member_scan` with correct logic
Create a new migration that drops and recreates the function with all required guards:
- **No subscription guard**: For non-cash members with `stripe_subscription_id IS NULL` and status not `pending_activation` → deny with `no_active_subscription`
- **Subscription status guard**: For members with a subscription, deny if status is anything other than `active` or `trialing` (catches `past_due`, `incomplete`, `canceled`, `unpaid`)
- **Recent failed payment guard**: Query `payment_attempts` for failures in last 30 days
- **Annual fee guard**: Check `annual_fee_paid_at` expiration
- **Billing block flag**: Return `is_billing_block: true` so the UI knows override is not available
- **Cash billing exemption**: Skip subscription checks for `billing_type = 'cash'`
- Keep existing blocked-person check, token validation, check-in creation, and audit logging

### 2. Fix the client-side billing issues hook
In `useMembersBillingIssues.ts`:
- Add check for `subscription_status = 'past_due'` → issue code `subscription_past_due`, type `error`
- Add check for `subscription_status = 'canceled'` or `'unpaid'` → issue code `subscription_canceled`
- For non-cash members with `status = 'active'` and `stripe_subscription_id` is null → already handled as `missing_subscription` (verify this works)
- Update `canMemberCheckIn` to also block on the new codes

### 3. Update `getEffectiveStatus` in `EffectiveStatusBadge.tsx`
- Add `subscription_past_due` to the payment-failure check alongside `failed_payment`, `subscription_incomplete`, etc.
- This ensures the status banner, badge, and check-in button all reflect the denial

### 4. Make check-in page pre-validate via backend (not just client)
In `CheckIn.tsx`, when a member is selected:
- Call `scanMemberAsync` with `autoCheckIn: false` immediately to get the backend's verdict
- Use the backend result to determine the approval/denial banner, not just the client-side `getEffectiveStatus`
- This eliminates the "client says approved, backend says denied" disconnect
- Only show the "Check In Member" button if the backend pre-check returned `access_granted: true`

### 5. Update the backend RPC to support dry-run mode
Add `p_auto_check_in = false` behavior: when false, skip the `check_ins` insert but still return the full access decision. This allows the pre-validation call without creating a check-in record.

---

## Files to change
- New migration SQL: recreate `process_member_scan` with all guards
- `src/hooks/useMembersBillingIssues.ts` — add `past_due` / `canceled` subscription status checks
- `src/components/admin/EffectiveStatusBadge.tsx` — add new issue codes to payment failure check
- `src/pages/admin/CheckIn.tsx` — pre-validate via backend on member selection

## Result
- Members like Kaitlin (past_due subscription) and Sherene (no subscription) will be hard-blocked at both the UI and backend level
- Staff sees "Cannot Check In" immediately on selection, with the specific reason
- No way for the UI to show "approved" when the backend would deny
- Cash-billing members remain unaffected

