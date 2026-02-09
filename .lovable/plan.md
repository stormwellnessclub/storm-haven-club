

# Plan: Fix Jessica Seagull + Prevent Future Incomplete Subscription Issues

## Problem Summary

Jessica Seagull's subscription failed its first payment and transitioned to `incomplete_expired` in Stripe, but:
1. The webhook didn't catch this status and update her database
2. She still shows as `active` with a subscription ID in our database
3. The admin UI shows a green "Active" badge and hides the "Create Subscription" button
4. You can't fix her membership because the UI thinks she already has a subscription

**Current Database State:**
- Status: `active` 
- Subscription ID: `sub_1SylYkLyZrsSqLhscc5cqMwJ`
- **Actual Stripe Status:** `incomplete_expired` (subscription is dead)

---

## Solution: Two-Part Fix

### Part 1: Immediate Database Fix (Manual Query)

Clear Jessica's invalid subscription so you can create a new one:

```sql
UPDATE members 
SET 
  stripe_subscription_id = NULL,
  status = 'pending_activation'
WHERE id = '7fe78d81-976a-4b12-997d-92b241db6109';
```

You'll run this in Cloud View > Run SQL.

---

### Part 2: Code Fix - Handle `incomplete_expired` in Webhook

**File:** `supabase/functions/stripe-webhook/index.ts`

Update the `customer.subscription.updated` handler to catch `incomplete_expired`:

```text
Current code (lines 933-945):
┌────────────────────────────────────────────────────────────────┐
│ if (subscription.status === 'past_due' || ... 'unpaid') {     │
│   newStatus = 'past_due';                                      │
│ } else if (subscription.status === 'active') {                 │
│   newStatus = 'active';                                        │
│ } else if (subscription.status === 'canceled' || 'unpaid') {   │
│   newStatus = 'cancelled';                                     │
│ } else {                                                       │
│   // For other statuses - just log and break  ← PROBLEM!       │
│   break;                                                       │
│ }                                                              │
└────────────────────────────────────────────────────────────────┘
```

**Change to:**

```typescript
if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
  newStatus = 'past_due';
  reason = subscription.status === 'past_due' ? 'payment_past_due' : 'payment_unpaid';
} else if (subscription.status === 'active') {
  newStatus = 'active';
  reason = 'subscription_active';
} else if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
  // Treat incomplete_expired the same as canceled - subscription failed before starting
  newStatus = 'pending_activation';
  reason = subscription.status === 'canceled' ? 'subscription_canceled' : 'subscription_incomplete_expired';
  
  // Clear the dead subscription ID so admin can create a new one
  await supabase.from('members')
    .update({ stripe_subscription_id: null })
    .eq('id', memberData.id);
} else if (subscription.status === 'incomplete') {
  // Payment still processing - don't activate yet
  newStatus = 'pending_activation';
  reason = 'awaiting_first_payment';
} else {
  // trialing, paused, etc. - handle appropriately
  logStep("Subscription status not mapped", { status: subscription.status });
  break;
}
```

---

### Part 3: UI Enhancement - Show Real Subscription Status

**File:** `src/pages/admin/MemberDetail.tsx`

Currently the Subscription card always shows "Active" with a green badge if `stripe_subscription_id` exists. This is misleading when the Stripe subscription is actually dead.

**Option A (Simple):** Use the `BillingHealthCard` data which already fetches the real Stripe status.

**Option B (Better UX):** Add a quick status check when displaying the subscription:

```typescript
// Line ~1047-1061 - Subscription Card
{member.stripe_subscription_id ? (
  <div className="space-y-1">
    {/* Show actual billing health status if available */}
    {billingHealth?.duesSubscription?.status === 'incomplete_expired' || 
     billingHealth?.duesSubscription?.status === 'canceled' ? (
      <div className="flex items-center gap-2 text-red-600">
        <XCircle className="h-4 w-4" />
        <span className="font-medium">Expired/Canceled</span>
      </div>
    ) : billingHealth?.duesSubscription?.status === 'past_due' ? (
      <div className="flex items-center gap-2 text-amber-600">
        <AlertCircle className="h-4 w-4" />
        <span className="font-medium">Past Due</span>
      </div>
    ) : (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2 className="h-4 w-4" />
        <span className="font-medium">Active</span>
      </div>
    )}
    {/* Rest of subscription display... */}
    
    {/* Show Create button if subscription is dead */}
    {(billingHealth?.duesSubscription?.status === 'incomplete_expired' || 
      billingHealth?.duesSubscription?.status === 'canceled') && (
      <AdminActionButton
        label="Create New Subscription"
        tooltip="Replace the expired subscription"
        onClick={() => setShowCreateSubscriptionDialog(true)}
        isLoading={isCreatingSubscription}
      />
    )}
  </div>
) : (
  // ... existing "None" display
)}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/stripe-webhook/index.ts` | Add `incomplete_expired` handling in subscription.updated |
| `src/pages/admin/MemberDetail.tsx` | Show real subscription status + allow creating new one when dead |

---

## Immediate Action Required

After I implement the code fixes, you'll need to run this SQL to fix Jessica:

```sql
UPDATE members 
SET stripe_subscription_id = NULL, status = 'pending_activation'
WHERE id = '7fe78d81-976a-4b12-997d-92b241db6109';
```

Then you can create a new subscription for her through the admin UI.

---

## Summary

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Jessica stuck as "active" | Webhook doesn't handle `incomplete_expired` | Add status mapping in webhook |
| Can't create new subscription | UI hides button when subscription ID exists | Check actual Stripe status, allow replacing dead subscriptions |
| Database has stale data | No cleanup when subscription fails | Clear subscription ID when `incomplete_expired` |

