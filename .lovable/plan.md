

## Fix Payment-Failed Subscription Detection for Jessica Seagull

### Problem Identified
Jessica Seagull has a Stripe subscription (`sub_1Synu2LyZrsSqLhs6sdUaXD9`) with status **`incomplete`** - meaning payment failed on the initial attempt and the subscription never started. However:

1. The database still shows her `stripe_subscription_id` pointing to this dead subscription
2. Her status shows "pending_activation" but staff don't know WHY (payment failed)
3. The sync function explicitly **skips** `incomplete` subscriptions
4. There's no admin action to clear the dead subscription

### Root Cause
The `sync-subscription-status` edge function has this code at line 216:
```javascript
} else {
  continue; // Skip incomplete, etc.
}
```

This means `incomplete` subscriptions are silently ignored instead of being flagged or fixed.

### Solution Overview
Two fixes are needed:

1. **Update the sync function** to properly handle `incomplete` subscriptions
2. **Add a "Clear Dead Subscription" button** in the admin UI for immediate manual fixing

---

### Part 1: Update Sync Function

**File:** `supabase/functions/sync-subscription-status/index.ts`

**Changes:**
- Add handling for `incomplete` subscription status
- Clear the dead subscription ID from the database
- Log it as an issue so admin can see it in sync reports

```
When subscription.status === 'incomplete':
  - Clear stripe_subscription_id from the member record
  - Keep status as 'pending_activation'
  - Add to results as 'incomplete_subscription' issue type
  - Log: "Subscription payment failed before starting - subscription ID cleared"
```

---

### Part 2: Add "Clear Dead Subscription" Button

**File:** `src/pages/admin/MemberDetail.tsx`

**Changes:**
Add a button in the subscription section that allows admins to:
- Check the subscription status in Stripe
- If status is `incomplete`, `incomplete_expired`, or `canceled`:
  - Clear `stripe_subscription_id` from the database
  - Show success message
- If subscription is `active` or `past_due`:
  - Show warning that subscription is still valid

This will be placed next to the existing "Create Subscription" button with clear labeling:
```
[Clear Dead Subscription] - Use if subscription failed and needs to be replaced
```

---

### Part 3: Immediate Fix for Jessica Seagull

After deployment, admin can:
1. Go to Jessica Seagull's member detail page
2. Click "Clear Dead Subscription" to remove the `incomplete` subscription ID
3. Click "Create Subscription" to create a new membership subscription
4. The new subscription will attempt payment again

---

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/sync-subscription-status/index.ts` | Handle `incomplete` subscriptions - clear ID and log issue |
| `src/pages/admin/MemberDetail.tsx` | Add "Clear Dead Subscription" button with Stripe status check |

---

### Expected Outcome

1. Sync function will automatically detect and clear dead `incomplete` subscriptions
2. Admin can manually clear dead subscriptions for immediate fixes
3. Jessica Seagull's record will be fixed, allowing a new subscription to be created
4. Future members with failed initial payments will be properly flagged

