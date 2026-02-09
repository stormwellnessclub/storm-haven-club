
# Plan: Fix Membership Activation UI & Payment Status Logic

## Issues Identified

Based on my investigation, you've reported 5 distinct issues:

### 1. Dialog Scroll Issue (CreateSubscriptionDialog)
**Problem:** The CreateSubscriptionDialog content is too tall and you can't scroll to hit the "Create" button.

**Root Cause:** The `AlertDialogContent` in `CreateSubscriptionDialog.tsx` at line 163 uses `max-w-md` but doesn't have `max-h-[90vh] overflow-y-auto` to make it scrollable on smaller screens.

### 2. Dialog Doesn't Close After Creating Subscription
**Problem:** After hitting "Create", the CreateSubscriptionDialog stays open - you have to hit cancel.

**Root Cause:** In `MemberDetail.tsx` line 642, when `handleCreateSubscription` succeeds, it sets `showSubscriptionSuccessDialog(true)` but **never calls** `setShowCreateSubscriptionDialog(false)`. Both dialogs end up open simultaneously.

### 3. Stripe Cancellation Not Syncing to Admin UI
**Problem:** When you cancel a subscription in Stripe Dashboard, the admin UI still shows it as active.

**Root Cause:** The webhook handler for `customer.subscription.deleted` (line 974-1012 in stripe-webhook) correctly updates the database, but there's a bug - it only searches by `stripe_subscription_id` for dues subscriptions. If you cancel an **annual fee subscription**, it won't find the member because annual fee uses `annual_fee_subscription_id`. The lookup needs to check both fields.

### 4. No Payment Decline Notification in Admin UI
**Problem:** You don't know if a payment declines unless you go to Stripe.

**Current State:** The webhook already sends admin alert emails for failed payments (line 1548-1572 in stripe-webhook). However, there's no **in-app notification** or prominent dashboard alert. The `BillingHealthWidget` on the dashboard does show "Failed Payments" count, but it's not prominent enough.

**Solution:** Add a more prominent "Immediate Attention Required" alert card at the top of the dashboard when there are failed payments in the last 7 days.

### 5. Members Marked Active Despite Owing Payments
**Problem:** A member can be "active" even if they have declined payments.

**Current Logic:** The activation process sets status to "active" immediately. Stripe webhooks update to "past_due" when `invoice.payment_failed` fires, but there's a race condition if the initial subscription charge fails - the member was already set to "active" before the webhook processes.

**Solution:** Add a pre-activation payment verification step that confirms the first invoice was actually paid before marking active.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/CreateSubscriptionDialog.tsx` | Add scroll support to dialog content |
| `src/pages/admin/MemberDetail.tsx` | Close CreateSubscriptionDialog before showing success dialog |
| `supabase/functions/stripe-webhook/index.ts` | Fix subscription.deleted to check both subscription ID fields |
| `src/pages/admin/Dashboard.tsx` | Add prominent "Failed Payments Alert" card |
| `supabase/functions/stripe-payment/index.ts` | Add payment verification before setting member to active |

---

## Technical Implementation

### Fix 1: Dialog Scroll Issue

Add `max-h-[85vh] overflow-y-auto` to the AlertDialogContent:

```typescript
// CreateSubscriptionDialog.tsx line 163
<AlertDialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
```

### Fix 2: Close Dialog on Success

In `handleCreateSubscription` success handler, close the dialog first:

```typescript
// MemberDetail.tsx ~line 642
setShowCreateSubscriptionDialog(false); // ADD THIS LINE
setSubscriptionResult({...});
setShowSubscriptionSuccessDialog(true);
```

### Fix 3: Webhook Subscription Deleted Handler

Modify the lookup to check both `stripe_subscription_id` AND `annual_fee_subscription_id`:

```typescript
// stripe-webhook/index.ts case 'customer.subscription.deleted'
// First try membership subscription
let memberData = await supabase
  .from('members')
  .select('id')
  .eq('stripe_subscription_id', subscription.id)
  .maybeSingle();

// If not found, try annual fee subscription
if (!memberData?.data) {
  memberData = await supabase
    .from('members')
    .select('id')
    .eq('annual_fee_subscription_id', subscription.id)
    .maybeSingle();
  
  // If annual fee subscription was deleted, also clear annual_fee_subscription_id
  if (memberData?.data) {
    await supabase.from('members')
      .update({ annual_fee_subscription_id: null })
      .eq('id', memberData.data.id);
  }
}
```

### Fix 4: Dashboard Failed Payments Alert

Add a new prominent alert component at the top of the Dashboard that shows when there are recent failed payments:

```typescript
// New component or inline in Dashboard.tsx
{failedPaymentMembers.length > 0 && (
  <Card className="border-red-500 bg-red-50 dark:bg-red-950/30">
    <CardContent className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-6 w-6 text-red-600" />
        <div>
          <p className="font-semibold text-red-800">Payment Failures Require Attention</p>
          <p className="text-sm text-red-600">
            {failedPaymentMembers.length} member(s) had declined payments in the last 7 days
          </p>
        </div>
      </div>
      <Button variant="outline" asChild>
        <Link to="/admin/payments?filter=failed">Review</Link>
      </Button>
    </CardContent>
  </Card>
)}
```

### Fix 5: Verify Payment Before Activation

In the `admin_create_member_subscription` action, after creating the subscription, verify the first invoice status before marking member as active:

```typescript
// After subscription.create() in stripe-payment/index.ts
// Verify the first invoice was paid before activating
const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
  expand: ['latest_invoice']
});

const invoice = subscription.latest_invoice as Stripe.Invoice;
const isPaid = invoice?.status === 'paid' || invoice?.amount_due === 0;

// Update member status based on payment
const newStatus = isPaid ? 'active' : 'pending_activation';

await supabase.from('members').update({
  status: newStatus,
  stripe_subscription_id: subscriptionId,
  // ... other fields
}).eq('id', memberId);

// If payment failed, return a warning to the admin
if (!isPaid) {
  return new Response(JSON.stringify({
    success: true,
    subscriptionId,
    status: 'pending_payment',
    warning: 'Subscription created but initial payment is pending. Member will be activated when payment succeeds.',
    invoiceStatus: invoice?.status,
  }), ...);
}
```

---

## Summary

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Can't scroll to Create button | Missing scroll CSS | Add `max-h-[85vh] overflow-y-auto` |
| Dialog stays open | Missing `setShowCreateSubscriptionDialog(false)` | Add the call before showing success |
| Stripe cancel not syncing | Webhook only checks `stripe_subscription_id` | Also check `annual_fee_subscription_id` |
| No decline notifications | Email only, no in-app alert | Add dashboard alert card |
| Active despite owing | Race condition with webhook | Verify invoice status before activation |
