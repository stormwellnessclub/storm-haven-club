

# URGENT FIX: Stop Double-Charging Initiation Fees

## The Bug

Looking at the code in `supabase/functions/stripe-payment/index.ts`:

**Line 2383** - The member query is missing critical fields:
```typescript
.select('stripe_customer_id, user_id, email, first_name, last_name')
// MISSING: annual_fee_paid_at, annual_fee_subscription_id
```

**Lines 2501-2537** - The code ALWAYS creates a new annual fee subscription with NO checks:
```typescript
if (annualFeePriceId) {
  // NO CHECK if already paid!
  // NO CHECK if subscription already exists!
  const annualFeeSubscription = await stripe.subscriptions.create({...}); // CHARGES IMMEDIATELY
}
```

This means every time you activate a membership, the system creates a new initiation fee subscription and charges the card immediately - even if they already paid.

---

## The Fix

### Step 1: Update Member Query

Add the missing fields to know payment status:

```typescript
// Line 2383
.select('stripe_customer_id, user_id, email, first_name, last_name, annual_fee_paid_at, annual_fee_subscription_id')
```

### Step 2: Add Triple-Check Before Creating Annual Fee

Replace lines 2497-2537 with proper validation:

```typescript
// Check 1: Already paid in database?
const alreadyPaidInDB = !!memberData.annual_fee_paid_at;

// Check 2: Subscription ID already linked?
const hasLinkedSubscription = !!memberData.annual_fee_subscription_id;

// Check 3: Search Stripe for existing annual fee subscription (fallback)
let existingAnnualFeeSub = null;
if (!alreadyPaidInDB && !hasLinkedSubscription && annualFeePriceId) {
  const existingSubs = await stripe.subscriptions.list({
    customer: memberData.stripe_customer_id,
    limit: 20,
  });
  
  existingAnnualFeeSub = existingSubs.data.find(sub => {
    const isActiveOrTrialing = ['active', 'trialing'].includes(sub.status);
    const isAnnualFee = sub.metadata.type === 'annual_fee' || 
      sub.items.data.some(item => Object.values(STRIPE_PRODUCTS.annualFee).includes(item.price.id));
    return isActiveOrTrialing && isAnnualFee;
  });
}

// ONLY create if all three checks pass
if (alreadyPaidInDB) {
  logStep("SKIPPING annual fee - already paid", { annual_fee_paid_at: memberData.annual_fee_paid_at });
} else if (hasLinkedSubscription) {
  logStep("SKIPPING annual fee - subscription already linked", { annual_fee_subscription_id: memberData.annual_fee_subscription_id });
} else if (existingAnnualFeeSub) {
  logStep("SKIPPING annual fee - found existing in Stripe", { subscriptionId: existingAnnualFeeSub.id });
  // Link the existing subscription to the member
  await supabase.from('members').update({
    annual_fee_subscription_id: existingAnnualFeeSub.id,
  }).eq('id', memberId);
} else if (annualFeePriceId) {
  // ONLY NOW create new subscription
  const annualFeeSubscription = await stripe.subscriptions.create({...});
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/stripe-payment/index.ts` | Update query at line 2383, add triple-check at lines 2497+ |

---

## Summary of Checks

| Check | Purpose |
|-------|---------|
| `annual_fee_paid_at` | Was initiation fee marked as paid? |
| `annual_fee_subscription_id` | Is a subscription already linked? |
| Stripe API lookup | Is there an unlinked active subscription? |

Only if ALL THREE return negative will a new subscription be created.

---

## Immediate Action Required After Deploy

For members already double-charged, you'll need to:
1. Go to Stripe Dashboard
2. Cancel the duplicate initiation fee subscriptions
3. Process refunds for the extra charges
4. Run "Sync with Stripe" on affected members to clean up database

