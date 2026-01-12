# Annual Fee Strategy Decision

## Current Implementation

**Annual fees are charged as one-time payments:**
- Charged once during membership activation
- No automatic renewal
- Must manually track and charge each year
- Tracked via `annual_fee_paid_at` field in members table

## Options

### Option A: Keep One-Time Payments (Current)

**How it works:**
- Annual fee charged as one-time payment during activation
- No recurring subscription
- Manual tracking required each year

**Pros:**
- ✅ Already implemented and working
- ✅ Simpler (no subscription management)
- ✅ More control over annual fee timing

**Cons:**
- ❌ Manual work required each year
- ❌ Risk of missing annual fee payments
- ❌ No automatic tracking

**Best for:** Small membership base (< 100 members) where manual tracking is manageable

---

### Option B: Make Annual Fees Recurring Subscriptions

**How it would work:**
- Create separate recurring subscription for annual fees
- Automatic renewal each year
- Webhook handles renewals
- Use `annual_fee_subscription_id` field (already in schema)

**Pros:**
- ✅ Automatic renewal
- ✅ No manual work
- ✅ Better tracking and analytics
- ✅ Scalable

**Cons:**
- ❌ More complex implementation
- ❌ Requires webhook changes
- ❌ Need to handle subscription lifecycle

**Best for:** Growing membership base where scalability matters

---

## Implementation Required (if choosing Option B)

1. **Update Activation Flow:**
   - Create TWO subscriptions on activation:
     - Membership subscription (monthly/annual) ✅ Already exists
     - Annual fee subscription (yearly) ❌ Needs implementation

2. **Update Webhook Handler:**
   - Handle `invoice.payment_succeeded` for annual fee subscriptions
   - Update `annual_fee_paid_at` on renewal

3. **Update Edge Functions:**
   - `create_activation_checkout` - Create annual fee subscription
   - `create_subscription_from_payment` - Create annual fee subscription

4. **Database:**
   - `annual_fee_subscription_id` column already exists ✅

**Estimated Effort:** 2-3 hours

---

## Recommendation

**For < 100 members:** Option A (one-time payments) is fine
**For > 100 members or growing:** Option B (recurring subscriptions) recommended

---

## Decision

**Your choice:** [ ] Option A (Keep one-time)  [ ] Option B (Make recurring)

**Notes:**
- Option B provides better scalability and automation
- Option A is simpler and may be sufficient if membership is small
