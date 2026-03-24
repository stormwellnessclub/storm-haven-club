
Fix billing so staff can always see exactly what a member owes, which billing periods are unpaid, and why access is blocked — without having to rely on Stripe manually.

What’s wrong now
- The current system tracks payment attempts, but not a durable “dues owed by period” record.
- Clearing/replacing a dead subscription can remove the visible link to the old dues problem, so admins lose context like “March was never paid.”
- Failed subscription payments are only partially surfaced. Admin views still rely too much on local member fields, while the live truth is in Stripe invoices.
- Because of that, you can’t reliably answer:
  - how many months are past due
  - which exact dues periods are unpaid
  - total outstanding balance
  - whether a canceled subscription still left unpaid invoices behind

Implementation plan
1. Add a real billing arrears ledger in the backend
- Create a dedicated table for member billing obligations / invoice periods.
- Store: member, billing type, period covered, amount due, amount paid, Stripe invoice ID, Stripe subscription ID, status, failure reason, and whether the debt is still collectible.
- This becomes the source of truth for “March 9 dues is still owed.”

2. Sync Stripe invoice reality into that ledger
- Update webhook handling so subscription invoice events create/update the ledger on:
  - invoice created
  - payment failed
  - payment succeeded
  - uncollectible / void / closed states where applicable
- Keep payment_attempts for attempt history, but stop treating it as the only billing truth.
- Preserve owed records even if the member’s active subscription pointer changes later.

3. Stop losing debt context when replacing bad subscriptions
- Change the “clear dead subscription” flow so it only disconnects the broken current dues reference.
- Do not remove historical dues debt or make the UI look like nothing is owed.
- Keep old subscription/invoice history visible on the member record.

4. Calculate and expose what’s owed
- Add a backend summary for each member that returns:
  - total amount owed
  - unpaid month count
  - exact unpaid billing periods (ex: Mar 9–Apr 8)
  - latest decline reason
  - latest failed attempt / retry schedule
  - whether the current subscription is canceled but prior invoices remain unpaid
- Use Stripe invoice periods and statuses, not just member.status or subscription_status inference.

5. Surface it clearly in admin UI
- Update Member Detail billing area to show:
  - Amount Owed
  - Months Past Due
  - Unpaid Periods list
  - Latest failure reason
  - Current dues subscription vs historical unpaid invoices
- Update BillingHealthCard / SubscriptionCard / PaymentTimeline so staff can see both:
  - current subscription state
  - debt history still owed
- Update Failed Payments + Stripe Live tabs so they merge local attempt history with live open/uncollectible Stripe invoices.

6. Make check-in messaging reflect the debt
- Keep the hard block already added.
- Improve the denial reason to say things like:
  - “Cannot check in — 1 month past due ($250 owed for March dues)”
  - “Cannot check in — multiple unpaid dues periods”
- Use the new arrears summary instead of generic “payment failed” messaging alone.

7. Backfill and reconcile existing members
- Add an admin sync/rebuild process that pulls historical Stripe invoices for affected members and populates missing owed periods.
- Use that to repair cases like Sherene so March still shows as owed even after the canceled subscription was detached.
- Reconcile payment_attempts, member status, and live Stripe invoice state into one consistent view.

Files likely involved
- supabase/functions/stripe-webhook/index.ts
- supabase/functions/stripe-payment/index.ts
- new backend migration for billing arrears table/functions
- src/hooks/useAdminMemberBillingHealth.ts
- src/components/admin/BillingHealthCard.tsx
- src/components/admin/SubscriptionCard.tsx
- src/components/admin/FailedPaymentsTab.tsx
- src/components/admin/StripeLivePaymentsTab.tsx
- src/components/admin/FailedPaymentDetailSheet.tsx
- src/components/admin/PaymentTimeline.tsx
- src/hooks/usePaymentTracking.ts
- src/components/admin/EffectiveStatusBadge.tsx

Technical notes
- Keep payment_attempts as attempt-level telemetry.
- Add a separate obligation/ledger model for “what is owed.”
- Do not rely on stripe_subscription_id alone to determine debt.
- Use secure backend sync and proper RLS so staff can manage all records while members only see their own billing history.

Result
- You’ll be able to open a member and immediately see exactly how much they owe and for which months.
- Failed subscription payments will be tracked from Stripe invoice events, not guessed from member status.
- Replacing a canceled subscription will no longer erase visibility into old unpaid dues.
- Check-in blocking will remain enforced, but with specific debt messaging instead of vague failure states.
