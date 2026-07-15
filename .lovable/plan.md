## Goal
1. Ensure the freeze-fee "Pay Now" link actually completes payment reliably.
2. Block members with past-due balances from submitting a freeze request until they clear arrears.

## Changes

### 1. Block freeze requests when past-due (client + server)

**Server (migration)** – new SECURITY DEFINER RPC `check_freeze_block_status()`:
- Reads `members` row for the current user.
- Sums outstanding `billing_arrears` for the member (any row where `status` in open states and `outstanding_cents > 0`, dues + other types).
- Also treats `members.subscription_status = 'past_due'` as blocking.
- Returns `{ blocked: bool, outstanding_cents: int, reason: text }`.

**Server (migration)** – trigger `enforce_no_freeze_when_past_due` on `member_freezes` BEFORE INSERT:
- Calls the check above using `NEW.user_id`. If blocked, `RAISE EXCEPTION 'PAST_DUE_BLOCK: settle outstanding balance first'`. This closes the loophole even if the client is bypassed.

**Client** – `src/hooks/useMemberFreezes.ts`:
- Add `useFreezePastDueStatus()` that calls the new RPC.
- In `useFreezeEligibility`, fold `blocked`/`outstanding_cents` into the return object so `canFreeze` is false when blocked.
- In `useCreateFreezeRequest.onError`, detect `PAST_DUE_BLOCK` and surface a clear toast.

**Client** – `src/pages/member/FreezeRequest.tsx`:
- If `blocked`, render a red destructive Alert at the top: "You have $X.XX past due. Please settle your balance before requesting a freeze." with a "Pay Balance Now" button that invokes the existing `charge-member-arrears`/member arrears payment path (whichever the portal already uses; use `supabase.functions.invoke('stripe-payment', { action: 'create_arrears_checkout' })` if present, otherwise the existing member-facing arrears link).
- Hide the freeze request form while blocked (keep eligibility card visible).

### 2. Fix freeze-fee payment link

Root-cause pattern seen in reports: `window.location.href` navigation was blocked/lost when returning from Stripe, and no error surfaced when the edge function failed silently.

**`src/pages/member/FreezeRequest.tsx` `handlePayFreezeFee`:**
- Open the checkout URL in a new tab (`window.open(data.url, '_blank', 'noopener')`), matching the rest of the app's Stripe checkout pattern. Keep a fallback redirect if the popup is blocked.
- Show a clear error toast when the edge function returns an error, including any message from the response body.
- After opening, start a polling refetch of `member-freezes` every 5s for 2 minutes so the UI updates when payment completes without requiring a manual refresh.

**`supabase/functions/stripe-payment/index.ts` `create_freeze_fee_checkout`:**
- Validate that the freeze belongs to the caller (`select member_freezes where id = freezeId and user_id = auth user`) and that it is in `approved` status and `fee_paid = false`. Return a 400 with a descriptive message otherwise.
- Recalculate `freezeFeeAmount` server-side from `freeze_fee_total` on the DB row (do not trust the client amount).
- Include `success_url`/`cancel_url` sanity fallback to `stormwellnessclub.com/member/freeze`.
- Return `{ error: message }` with proper status on failure so the client toast is meaningful.

### 3. Small UX polish
- On the approved-request alert, show "Opens Stripe in a new tab" helper text next to the pay button.
- Disable the pay button while a checkout session is being created (already there) and re-enable on error.

## Out of scope
- Changing the fee amount, freeze policy, or admin approval flow.
- Any change to non-freeze billing.
