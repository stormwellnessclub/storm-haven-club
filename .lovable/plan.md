

## Plan: Fix Membership Dues Checkout Webhook Handler

### Root Cause Identified

Your $500 Diamond membership payment completed successfully in Stripe, BUT the webhook did not update your database because:

1. The checkout was created with metadata `type: 'membership_dues'`
2. The webhook only handles:
   - `membership_activation`
   - `class_pass`
   - `annual_fee_payment` / `annual_fee_subscription`
   - `guest_pass`
   - `freeze_fee`
3. It logged "Unknown checkout type" and did nothing → your `stripe_subscription_id` stayed NULL

**Current database state:**
- `annual_fee_paid_at`: ✓ Set (initiation fee paid)
- `annual_fee_subscription_id`: ✓ Set  
- `stripe_subscription_id`: ✗ NULL ← **This is the problem**

**Payment status logic requires:**
- `isInitiationFeePaid` = TRUE (checks `annual_fee_paid_at` OR `annual_fee_subscription_id`) ✓
- `hasActiveSubscription` = TRUE (checks `stripe_subscription_id`) ✗ **FAILS**

---

### Solution

Add a new handler case in the webhook for `type === 'membership_dues'` that:
1. Extracts `member_id`, `user_id`, `tier`, `gender`, `billing_type` from metadata
2. Updates the member's `stripe_subscription_id` with the new subscription ID
3. Updates card metadata if available

---

### File: `supabase/functions/stripe-webhook/index.ts`

**Location:** Insert new case before line 595 (the `else` clause for unknown types)

**Add handler for `membership_dues` type:**

```typescript
} else if (metadata.type === 'membership_dues') {
  // Handle self-service dues subscription checkout
  const memberId = metadata.member_id;
  const userId = metadata.user_id;
  const tier = metadata.tier;
  const billingType = metadata.billing_type;

  if (!memberId) {
    logError("Missing member_id in membership_dues metadata", "MEMBERSHIP_DUES");
    return errorResponse(new Error("Missing member_id in metadata"), "MEMBERSHIP_DUES");
  }

  // Get subscription ID from session
  const subscriptionId = session.subscription as string;

  if (!subscriptionId) {
    logError("No subscription ID in membership_dues session", "MEMBERSHIP_DUES");
    return errorResponse(new Error("No subscription ID in session"), "MEMBERSHIP_DUES");
  }

  try {
    // Update member record with subscription ID
    const updateData: Record<string, any> = {
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: session.customer as string,
      updated_at: new Date().toISOString(),
    };

    // If billing_type was set, update it
    if (billingType) {
      updateData.billing_type = billingType;
    }

    const { error: updateError } = await supabase
      .from('members')
      .update(updateData)
      .eq('id', memberId);

    if (updateError) {
      logError(updateError, "MEMBERSHIP_DUES_UPDATE");
      return errorResponse(updateError, "MEMBERSHIP_DUES_UPDATE");
    }

    logStep("Membership dues subscription linked", { 
      memberId, 
      subscriptionId,
      tier,
      billingType
    });

    // Try to update card metadata from the subscription's default payment method
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const defaultPMId = subscription.default_payment_method as string | null;
      
      if (defaultPMId) {
        const pm = await stripe.paymentMethods.retrieve(defaultPMId);
        if (pm.card) {
          await supabase
            .from('members')
            .update({
              card_brand: pm.card.brand,
              card_last4: pm.card.last4,
              card_exp_month: pm.card.exp_month,
              card_exp_year: pm.card.exp_year,
            })
            .eq('id', memberId);
          logStep("Card metadata synced", { last4: pm.card.last4 });
        }
      }
    } catch (cardError) {
      logError(cardError, "MEMBERSHIP_DUES_CARD_SYNC");
      // Don't fail the webhook for card sync issues
    }

  } catch (duesError) {
    logError(duesError, "MEMBERSHIP_DUES");
    return errorResponse(duesError, "MEMBERSHIP_DUES");
  }
}
```

---

### Immediate Database Fix

Since you already paid the $500 and we can see your subscription in Stripe (`sub_1SvFWvLyZrsSqLhsaeSwc3eG` with price `price_1Sl9wILyZrsSqLhsLjYqkoqq` - Diamond Women Monthly), I will also update your member record directly:

**Manual SQL fix needed for your account:**
```sql
UPDATE members 
SET stripe_subscription_id = 'sub_1SvFWvLyZrsSqLhsaeSwc3eG'
WHERE id = '8c9ffb27-85ae-4732-a904-3334b50c4e33';
```

---

### Summary

| Task | Action |
|------|--------|
| Add webhook handler | Handle `membership_dues` checkout type |
| Update your record | Link the existing subscription ID |
| Prevent future issues | New checkouts will be handled correctly |

### What This Fixes

After this change:
- Your payment status logic will see `stripe_subscription_id` is set
- The "Payment Required — Benefits Frozen" banner will disappear
- Future self-service dues checkouts will work correctly

