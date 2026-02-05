

# Pre-Activation Tier Change for Non-Subscribed Members

## Your Situation

You have a member who:
- ✅ Applied for **Diamond** membership
- ✅ Paid the **initiation fee** (annual fee)
- ✅ Was **approved**
- ❌ Has **NOT been activated** yet
- ❌ Has **NO Stripe subscription** yet
- 🔄 Wants to **downgrade to Silver** before activation

## Why the Current "Change Tier" Button Doesn't Work

The `TierChangeDialog` is designed for **active members with existing Stripe subscriptions**. It modifies the subscription in Stripe to swap prices—but this member has no subscription to modify yet.

The error message "Please create a subscription first" is technically correct but unhelpful in your scenario.

## The Solution: Smart Tier Change Dialog

I'll enhance the `TierChangeDialog` to handle **two modes**:

| Mode | Scenario | What Happens |
|------|----------|--------------|
| **Database-Only** | No subscription exists | Simply updates `membership_type` in database |
| **Stripe Update** | Active subscription | Modifies Stripe subscription with proration |

---

## Technical Implementation

### Modified TierChangeDialog Behavior

When `hasActiveSubscription = false`:

1. **Hide proration options** (not applicable)
2. **Replace error message** with informative text:
   > "This member doesn't have an active subscription yet. Changing the tier will update their membership record. The new tier will apply when their subscription is created at activation."
3. **Enable the button** to allow database-only tier changes
4. **Update just the database** (`members.membership_type`)

### Visual Flow for Your Scenario

```text
┌────────────────────────────────────────────────────────────┐
│ Change Membership Tier                                      │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ Current Tier: [Diamond ◆]                                   │
│                                                             │
│ New Tier: [Silver ▼]                                        │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Diamond  →  Silver                                      ││
│ │ $500/mo      $200/mo                                    ││
│ │                                                         ││
│ │ ↓ Downgrade                                             ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ ⓘ This member doesn't have an active subscription yet.     │
│   The new tier will be used when their subscription is     │
│   created during activation.                                │
│                                                             │
│ ⚠️ They have already paid the initiation fee. If the       │
│   Diamond fee was higher, you may need to process a        │
│   partial refund separately.                                │
│                                                             │
│                              [Cancel] [Change to Silver]    │
└────────────────────────────────────────────────────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/TierChangeDialog.tsx` | Add database-only mode for non-subscribed members |

### Code Changes

1. **Add database-only mutation** alongside the Stripe mutation
2. **Switch between modes** based on `hasActiveSubscription` prop
3. **Show different UI** (no proration, different messaging) for non-subscribed members
4. **Add warning about initiation fee** if member already paid (may need refund consideration)

---

## Benefits

- **Immediate fix** for your Diamond → Silver member
- **No Stripe interaction** required for pre-activation changes
- **Clear messaging** so admins understand what's happening
- **Works for all approved/pending_activation members** before they get a subscription

---

## Edge Case: Initiation Fee Difference

Your member paid the Diamond initiation fee. If Diamond and Silver have the same initiation fee structure, no additional action is needed. If they differ, the dialog will remind the admin to handle any refund separately.

