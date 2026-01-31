
# Admin Membership Upgrade/Downgrade Feature

## Summary
Add the ability for admins to upgrade or downgrade a member's membership tier (Silver, Gold, Platinum, Diamond) directly from the Member Detail page. This will update both the database record and the Stripe subscription with the new pricing.

## Current State Analysis
- Members have a `membership_type` field storing their tier (Silver, Gold, Platinum, Diamond)
- Active subscriptions are tied to Stripe price IDs that correspond to each tier/gender/billing combination
- The `stripe-payment` edge function already has `admin_create_member_subscription` action for creating subscriptions
- There's an `update_subscription_billing` action but it doesn't change the price/tier
- Credits are allocated based on tier (Silver: none, Gold: 4 red light + 2 cryo, Platinum: 6 + 4, Diamond: 10 + 6 + 10 classes)

## User Experience

### Admin Flow
1. Admin navigates to `/admin/members/:id` (Member Detail page)
2. In the **Membership** tab or header summary card, admin sees an **"Upgrade/Downgrade"** button
3. Clicking opens a dialog showing:
   - Current tier with current pricing
   - Available tiers (Silver, Gold, Platinum, Diamond)
   - New pricing for selected tier based on member's gender and billing type
   - Proration options (create prorations, no prorations, immediate invoice)
4. Admin selects new tier and confirms
5. System updates Stripe subscription and database
6. Success confirmation shows new tier, subscription details, and any prorated charges

### Restrictions
- Diamond is only available for women (enforced by Stripe price IDs)
- Cannot change tier if member has no active Stripe subscription
- Founding members stay on annual billing when changing tiers

## Technical Implementation

### 1. New Edge Function Action: `admin_update_member_tier`

Location: `supabase/functions/stripe-payment/index.ts`

```text
New action parameters:
- memberId: string (required)
- newTier: 'silver' | 'gold' | 'platinum' | 'diamond' (required)
- prorationBehavior: 'create_prorations' | 'none' | 'always_invoice' (default: 'create_prorations')

Logic:
1. Verify admin role (super_admin, admin, manager)
2. Fetch member data (stripe_subscription_id, gender, billing_type)
3. Validate new tier is available for member's gender
4. Get current Stripe subscription with items
5. Get new price ID based on tier + gender + billing_type
6. Update Stripe subscription item with new price
7. Update members table with new membership_type
8. Handle credit adjustments for new tier
9. Return success with prorated amount (if any)
```

### 2. Frontend: Upgrade/Downgrade Dialog Component

New component: `src/components/admin/TierChangeDialog.tsx`

Features:
- Select dropdown for new tier (filtered by gender restrictions)
- Preview of price change
- Proration behavior selector
- Confirmation with visual diff

### 3. MemberDetail.tsx Updates

Add to the Membership tab:
- "Change Tier" button in the Membership Details card
- Dialog state management
- Mutation for tier change API call
- Success/error toast notifications

## Proration Handling

According to Stripe documentation:
- `create_prorations` (default): Credits unused time on old price, charges for remaining time on new price
- `none`: No adjustments - new price applies from next billing cycle
- `always_invoice`: Immediately creates and attempts to pay an invoice for the proration

For **upgrades** (e.g., Silver → Gold): Member is charged prorated difference immediately
For **downgrades** (e.g., Gold → Silver): Member receives credit toward next invoice

## Credit Adjustments

When tier changes, credits should be adjusted:
- If upgrading: Add the difference in credits for the current cycle
- If downgrading: Credits remain as-is until next renewal (don't remove existing credits)

| Tier | Class | Red Light | Dry Cryo |
|------|-------|-----------|----------|
| Silver | 0 | 0 | 0 |
| Gold | 0 | 4 | 2 |
| Platinum | 0 | 6 | 4 |
| Diamond | 10 | 10 | 6 |

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/stripe-payment/index.ts` | Modify | Add `admin_update_member_tier` action |
| `src/components/admin/TierChangeDialog.tsx` | Create | Dialog component for tier selection |
| `src/pages/admin/MemberDetail.tsx` | Modify | Add trigger button and dialog integration |

## Edge Function Implementation Details

```text
case 'admin_update_member_tier': {
  // Required parameters
  const { memberId, newTier, prorationBehavior = 'create_prorations' } = body;

  // 1. Verify admin role
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['super_admin', 'admin', 'manager']);

  if (!roleData || roleData.length === 0) {
    throw new Error("Unauthorized: Admin access required");
  }

  // 2. Fetch member data
  const { data: memberData } = await supabase
    .from('members')
    .select('*')
    .eq('id', memberId)
    .single();

  // 3. Validate subscription exists
  if (!memberData.stripe_subscription_id) {
    throw new Error("Member has no active subscription to modify");
  }

  // 4. Get new price ID
  const normalizedGender = memberData.gender === 'male' ? 'men' : 'women';
  const billingType = memberData.billing_type || 'monthly';
  const newPriceId = STRIPE_PRODUCTS.memberships[newTier][billingType][normalizedGender];

  if (!newPriceId) {
    throw new Error(`${newTier} tier not available for ${normalizedGender}`);
  }

  // 5. Retrieve current subscription
  const subscription = await stripe.subscriptions.retrieve(memberData.stripe_subscription_id);
  const subscriptionItemId = subscription.items.data[0].id;

  // 6. Update subscription with new price
  const updatedSubscription = await stripe.subscriptions.update(memberData.stripe_subscription_id, {
    items: [{
      id: subscriptionItemId,
      price: newPriceId,
    }],
    proration_behavior: prorationBehavior,
  });

  // 7. Update database
  await supabase
    .from('members')
    .update({
      membership_type: capitalizeFirstLetter(newTier),
      updated_at: new Date().toISOString(),
    })
    .eq('id', memberId);

  // 8. Adjust credits if upgrading
  // (Add additional credits for upgraded tier)

  return { success: true, subscription: updatedSubscription };
}
```

## Security Considerations

1. **Role Verification**: Only super_admin, admin, or manager roles can change tiers
2. **Stripe Validation**: Subscription must exist and be in valid state
3. **Gender Restrictions**: Diamond tier blocked for men at the Stripe price ID level
4. **Audit Trail**: Changes logged via Stripe subscription history and database `updated_at`

## Testing Checklist

1. Upgrade from Silver to Gold - verify prorated charge
2. Downgrade from Platinum to Silver - verify credit applied
3. Attempt Diamond for male member - verify error
4. Change tier for member without subscription - verify error
5. Verify credits are adjusted appropriately
6. Verify Stripe Dashboard shows correct subscription state
