
## Fix Failed Payment/Incomplete Subscription Detection

### Problem Summary
Members with failed initial payments (Stripe subscription status = `incomplete`) are incorrectly showing as having an "active subscription" because the system only checks if `stripe_subscription_id` exists, not whether the subscription is actually `active` in Stripe.

This causes:
1. Member portal showing no payment issues
2. Admin list showing "Active" status
3. No email to member about failed payment
4. Potential access at check-in

---

### Part 1: Member Portal - Detect Incomplete Subscriptions

**Files:** `src/hooks/usePaymentStatus.ts`, `src/hooks/useMemberBenefitsStatus.ts`

Currently `hasActiveSubscription = !!membership.stripe_subscription_id` - this only checks if ID exists.

**Fix:** Add a new hook or enhance existing to check actual Stripe subscription status. Options:
- Add `subscription_status` column to `members` table (synced by webhook)
- Or call Stripe on-demand (adds latency)

**Recommended:** Add `subscription_status` column to `members` table

```sql
ALTER TABLE members ADD COLUMN subscription_status text DEFAULT 'none';
-- Values: 'none', 'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'
```

Update `usePaymentStatus` to check:
```typescript
const hasActiveSubscription = !!membership.stripe_subscription_id && 
  ['active', 'trialing'].includes(membership.subscription_status || '');
```

---

### Part 2: Webhook - Sync Subscription Status

**File:** `supabase/functions/stripe-webhook/index.ts`

Update webhook handlers to sync `subscription_status` to members table:
- `customer.subscription.created`
- `customer.subscription.updated` 
- `invoice.payment_failed` (for initial invoice failures)
- `invoice.payment_succeeded`

For initial payment failures (subscription `incomplete`):
- Update `subscription_status = 'incomplete'` in members table
- Send failure email (already exists for `invoice.payment_failed`)
- Ensure status remains `pending_activation`

---

### Part 3: Admin Billing Issues Hook - Detect Incomplete

**File:** `src/hooks/useMembersBillingIssues.ts`

Add detection for incomplete subscriptions. Either:
- Check new `subscription_status` column
- Or add RPC to batch-check Stripe statuses (slower)

Add new issue type:
```typescript
if (member.subscription_status === 'incomplete') {
  issues.push({
    type: "error",
    code: "subscription_incomplete",
    message: "Initial payment failed - subscription never started",
    shortLabel: "Payment Failed",
  });
}
```

---

### Part 4: Check-in Scanner - Use Subscription Status

**File:** `supabase/migrations/[new]_update_scanner_check_subscription_status.sql`

Update `process_member_scan` function to check `subscription_status` column:

```sql
-- Check if subscription is actually active
IF v_member.stripe_subscription_id IS NOT NULL 
   AND v_member.subscription_status NOT IN ('active', 'trialing') THEN
  v_access_granted := false;
  v_denial_reason := 'payment_failed';
END IF;
```

---

### Part 5: Member Portal Banner

**File:** `src/components/member/PaymentDueNotice.tsx`

Update to show for `incomplete` subscription status:

```typescript
const isSubscriptionIncomplete = membership.subscription_status === 'incomplete' 
  || membership.subscription_status === 'incomplete_expired';

if (!isInitiationFeePaid || !hasActiveSubscription || isSubscriptionIncomplete || isDuesPastDue) {
  // Show payment banner
}
```

---

### Part 6: Sync Function Update

**File:** `supabase/functions/sync-subscription-status/index.ts`

Already updated to handle `incomplete` subscriptions - verify it also updates the new `subscription_status` column.

---

### Database Migration

```sql
-- Add subscription_status column to members table
ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'none';

-- Update existing members based on their current state
UPDATE public.members 
SET subscription_status = CASE
  WHEN stripe_subscription_id IS NULL THEN 'none'
  WHEN status = 'active' AND stripe_subscription_id IS NOT NULL THEN 'active'
  WHEN status = 'past_due' THEN 'past_due'
  ELSE 'none'
END
WHERE subscription_status IS NULL OR subscription_status = 'none';

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_members_subscription_status 
ON public.members(subscription_status);
```

---

### Files to Modify

| File | Changes |
|------|---------|
| Database migration | Add `subscription_status` column |
| `stripe-webhook/index.ts` | Sync subscription status on all subscription events |
| `stripe-payment/index.ts` | Set initial `subscription_status` when creating subscriptions |
| `sync-subscription-status/index.ts` | Update `subscription_status` during sync |
| `usePaymentStatus.ts` | Check `subscription_status` not just existence of ID |
| `useMemberBenefitsStatus.ts` | Use new status logic |
| `useMembersBillingIssues.ts` | Detect `incomplete` subscriptions |
| `PaymentDueNotice.tsx` | Show for incomplete subscriptions |
| `process_member_scan` (SQL function) | Check subscription status for access |

---

### Verification Checklist

After implementation:
- [ ] Member with `incomplete` subscription sees payment banner
- [ ] Member with `incomplete` subscription cannot check in
- [ ] Admin sees "Payment Failed" status in member list
- [ ] Sync function clears dead subscription IDs
- [ ] Webhook updates status on payment success/failure
- [ ] Email sent on initial payment failure

---

### Immediate Fix (Before Full Implementation)

Run sync for all members with subscriptions to detect and fix incomplete ones:
1. Go to any member detail page
2. Click "Sync" in billing health card
3. Or trigger sync-subscription-status edge function for all members
