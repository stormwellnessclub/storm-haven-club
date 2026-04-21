

## Fix cancellation logic and harden payment-failure reconciliation

You’re right: the cancellation rule needs to be explicit and narrowly scoped, and the current logic is too loose in a few places. I reviewed the UI, member portal, and backend paths that currently influence “cancelled” and found that the system is mixing together:
- application-portal cancellation,
- Stripe subscription cancellation,
- member status,
- and arrears reconciliation.

That is the source of the logic gaps.

### What is already true today

- In the **Applications** admin page, marking an application as `cancelled` or `rejected` already updates a matching `members` record to `status = 'cancelled'` when that member is still `pending_activation`.
- The **member portal** already reads from `members.status`, so if the member row is correctly synced, the portal follows it.
- But other backend paths still infer `members.status = 'cancelled'` from Stripe subscription state:
  - `supabase/functions/sync-subscription-status/index.ts`
  - `supabase/functions/stripe-payment/index.ts` (`sync_member_billing_data`)
- That conflicts with your rule for this workflow.

## New rule to implement

For the cancellation work we’re doing right now:

- A membership is considered **Cancelled** only when **you mark the application cancelled in the application portal**.
- Stripe subscription cancellation alone must **not** cause the member to be treated as “cancelled” for this workflow.
- Activated-member cancellation will be handled under a separate protocol later and should not be mixed into this arrears logic now.

## Implementation plan

### 1. Make application-portal cancellation the only “cancelled” source for this flow

I’ll preserve the existing application-portal sync, but formalize it so it becomes the authoritative source for this case.

Changes:
- Keep the existing sync in `src/pages/admin/Applications.tsx`, but narrow and document it:
  - only sync `members.status = 'cancelled'` when the matching member is still `pending_activation`
  - do not treat `rejected` as equivalent to `cancelled` for arrears classification unless you want that explicitly
- Add a dedicated backend-safe helper/RPC for this sync instead of relying on page-level UI logic alone, so the rule is enforced consistently even if the app UI changes later.

Result:
- “Cancelled” for this current workflow will mean: cancelled in application portal, synced to pending-activation member record.

### 2. Stop backend billing sync from auto-cancelling members in this workflow

These are the main logic leaks I found:
- `sync-subscription-status` sets `expectedStatus = 'cancelled'` for Stripe `canceled` / `incomplete_expired`
- `stripe-payment` → `sync_member_billing_data` can set `updates.status = 'cancelled'` when Stripe says the subscription is canceled

That is too aggressive for your rule.

I’ll change those paths so they:
- continue syncing `subscription_status`
- continue syncing payment/card/subscription metadata
- do **not** auto-set `members.status = 'cancelled'` just because Stripe says a subscription is canceled
- use `past_due`, `incomplete`, `unpaid`, `no_subscription`, or leave the member lifecycle status alone instead

Result:
- Stripe billing state remains visible
- but it no longer hijacks membership lifecycle state

### 3. Rework failed-payment/arrears classification so “Cancelled” only uses application status for this audit

The arrears and failed-payment audit will be updated to classify rows with a stricter decision tree:

```text
If application is cancelled in application portal
  and matching member is/was pending_activation
    => Cancelled
Else if Stripe is still retrying
    => Retrying
Else if there are later successful non-disputed collections covering later cycles
    => Superseded
Else if invoice is still unpaid and no later valid recovery
    => Action needed
Else
    => Needs review
```

Important correction:
- I will remove Stripe subscription cancellation as a direct “Cancelled” signal from this reconciliation pass.
- Sarah / Miriam / others will only show as cancelled if the application-side cancellation rule is satisfied.
- Disputed charges will not count as valid “paid since” evidence.

### 4. Add dispute-aware payment validation

You specifically called out Sarah being shown as succeeded when the charge was disputed. That means the current logic is counting raw success without checking what happened after settlement.

I’ll fix reconciliation so:
- a charge that later became disputed is flagged separately
- disputed-and-lost charges do not count as proof that the arrear was recovered
- dispute state is shown alongside the row/drilldown

Result:
- “succeeded” won’t falsely imply “good standing”

### 5. Make the member portal reflect the correct lifecycle source cleanly

The member portal already relies on `members.status`, which is good. The real problem is status corruption upstream.

I’ll still do a full portal-path audit across:
- `useUserMembership`
- `usePaymentStatus`
- `useMemberBenefitsStatus`
- `ProtectedPortalRoute`
- `MemberLayout`

and make sure:
- application-cancelled pending-activation members are blocked/shown correctly
- Stripe subscription cancellation alone does not incorrectly make someone “cancelled”
- payment problems stay in payment/problem states, not lifecycle states

Result:
- application portal and member portal will speak the same language for this rule

### 6. Tighten the billing health / issue widgets so they don’t over-report cancelled logic

I also found other admin health logic that can confuse lifecycle vs billing:
- `useMembersBillingIssues`
- `BillingHealthWidget`
- `BillingHealthCard`
- `EffectiveStatusBadge`

I’ll update these so:
- “subscription canceled” remains a billing issue
- but does not automatically imply member lifecycle “cancelled”
- lifecycle badges and billing issue badges stay separate

This prevents staff from seeing mixed signals like:
- “cancelled member” when really it is
- “subscription canceled / no active billing setup”

### 7. Add explicit audit fields and resolution reasons for failed-payment cleanup

To make this robust and reduce future ambiguity, I’ll extend resolution/reconciliation with structured reasons such as:
- `application_cancelled`
- `superseded_by_later_payment`
- `stripe_retry_in_progress`
- `disputed_charge`
- `written_off_uncollectible`
- `manual_resolution`

This will be used both in the failed-payments history workflow and any arrears cleanup actions, so later reviews don’t require re-investigating why something was resolved.

### 8. Run a full logic-gap audit before implementation is considered done

Before calling this complete, I will re-audit all relevant paths end-to-end:

**Admin / application layer**
- `src/pages/admin/Applications.tsx`
- failed payments / arrears UI
- sidebar count logic

**Member portal layer**
- `src/hooks/useUserMembership.ts`
- `src/hooks/usePaymentStatus.ts`
- `src/hooks/useMemberBenefitsStatus.ts`
- `src/components/portal/ProtectedPortalRoute.tsx`
- `src/components/member/MemberLayout.tsx`

**Backend / billing sync**
- `supabase/functions/stripe-payment/index.ts`
- `supabase/functions/sync-subscription-status/index.ts`
- `supabase/functions/stripe-webhook/index.ts`

**Data model / arrears**
- `billing_arrears`
- `payment_attempts`
- `membership_applications`
- `application_status_history`
- `members`

## Robustness improvements to add next for payment failures / expired cards / past due

After the cancellation rule is corrected, the next robustness pass should add:

1. **Single source of truth reconciliation label**
   - one computed status per arrears row:
   - `cancelled`, `retrying`, `superseded`, `disputed`, `action_needed`, `resolved`

2. **Dispute-aware recovery logic**
   - no more counting disputed charges as successful recovery

3. **Card-risk monitoring**
   - separate buckets for:
     - no card
     - expired card
     - expiring within 30 days
     - card metadata stale/not synced

4. **Retry-state visibility**
   - show exact next retry date/time in Chicago time
   - distinguish “Stripe still working” from “abandoned”

5. **Current-cycle vs legacy-invoice separation**
   - prevent old abandoned invoices from making a currently-paying member look delinquent

6. **Bulk cleanup actions**
   - resolve cancelled-app rows
   - resolve superseded rows
   - leave real collectible balances untouched

7. **More defensive observability**
   - structured log tags for reconciliation mismatches
   - explicit drift reasons, not just generic failure counts

## Timezone handling

Michigan is Eastern Time, so any due/retry/reporting timestamps in this payment-failure workflow should use:
- `America/Detroit`

I will correct any “Chicago” assumptions in the payment-tracking/reconciliation presentation and scheduling logic for this reporting flow so due dates, retry dates, and audit displays align with your local operations.

## Deliverable outcome

After this revision is implemented:

- “Cancelled” in this current audit will only mean what you want it to mean: cancelled in the application portal
- subscription cancellation and billing failures will stay billing states, not lifecycle cancellation
- disputed charges won’t be misread as valid recovery
- the application portal and member portal will stay aligned
- the failed-payments report will be much more trustworthy and less prone to the logic mistakes you’ve been catching

