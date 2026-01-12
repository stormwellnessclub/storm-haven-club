# Stripe Integration: Fixes & Optimizations

**Priority: HIGH → MEDIUM → LOW**

---

## 🔴 HIGH PRIORITY FIXES

### 1. Fix Guest Pass Price ID ❌

**Issue:** Placeholder `TODO_ADD_STRIPE_PRICE_ID` in code

**Location:**
- `src/lib/stripeProducts.ts:73`
- Used in `supabase/functions/stripe-payment/index.ts` (guest pass checkout)
- Used in `supabase/functions/stripe-webhook/index.ts` (guest pass processing)

**Impact:**
- Guest pass feature blocked
- Code references non-existent price ID

**Fix Required:**
1. Create price in Stripe Dashboard ($60 one-time payment)
2. Update `src/lib/stripeProducts.ts` with actual price ID
3. Verify Edge Functions use the updated constant

**Files to Update:**
- `src/lib/stripeProducts.ts` (line 73)
- Check if Edge Functions import this or hardcode the value

**Effort:** ⏱️ 10 minutes

---

### 2. Implement Annual Fee Recurring Subscriptions ⚠️

**Issue:** Annual fees are charged as one-time payments, not recurring subscriptions

**Current Behavior:**
- Annual fee charged once during activation
- No automatic renewal
- Must manually track and charge each year

**Desired Behavior:**
- Annual fee as separate recurring subscription
- Automatic renewal each year
- Webhook handles renewals

**Impact:**
- Manual work required each year
- Risk of missing annual fee payments
- No automatic tracking

**Fix Required:**

1. **Update Activation Flow:**
   - Create TWO subscriptions on activation:
     - Membership subscription (monthly/annual)
     - Annual fee subscription (yearly)
   - Store `annual_fee_subscription_id` in members table

2. **Update Webhook Handler:**
   - Handle `invoice.payment_succeeded` for annual fee subscriptions
   - Update `annual_fee_paid_at` on renewal

3. **Update Edge Functions:**
   - Modify `create_activation_checkout` to create annual fee subscription
   - Modify `create_subscription_from_payment` to create annual fee subscription

**Files to Update:**
- `supabase/functions/stripe-payment/index.ts` (activation checkout)
- `supabase/functions/stripe-webhook/index.ts` (invoice.payment_succeeded handler)
- Database already has `annual_fee_subscription_id` column ✅

**Effort:** ⏱️ 2-3 hours

**Note:** This is a significant change. Consider if you want annual fees to be recurring or stay as one-time payments.

---

## 🟡 MEDIUM PRIORITY OPTIMIZATIONS

### 3. Eliminate Price ID Duplication 🔄

**Issue:** Price IDs duplicated between `stripeProducts.ts` and Edge Functions

**Location:**
- `src/lib/stripeProducts.ts` - Has all price IDs
- `supabase/functions/stripe-payment/index.ts` - Has duplicate `STRIPE_PRODUCTS` constant
- `supabase/functions/stripe-webhook/index.ts` - May reference prices

**Impact:**
- Risk of inconsistency
- Maintenance burden (must update in multiple places)
- Potential bugs from mismatched IDs

**Fix Required:**
1. Keep single source of truth in `stripeProducts.ts`
2. Edge Functions should import/use shared constants
3. OR create shared TypeScript file that Edge Functions can import

**Challenge:** Edge Functions run in Deno, not Node.js - may need different approach

**Options:**
- **Option A:** Export constants as JSON, import in Edge Functions
- **Option B:** Create shared constants file in Edge Functions folder
- **Option C:** Keep duplication but add validation/comments

**Effort:** ⏱️ 1-2 hours

---

### 4. Review Subscription Pause/Resume Integration 🔄

**Issue:** `pause_subscription` and `resume_subscription` actions exist but may not be integrated with freeze flow

**Location:**
- `supabase/functions/stripe-payment/index.ts` (actions exist)
- Freeze flow (need to verify integration)

**Impact:**
- Freezes may cancel subscriptions instead of pausing
- Credits may not be handled correctly during freezes

**Fix Required:**
1. Verify freeze flow uses pause/resume
2. Ensure credits are handled correctly
3. Test freeze/unfreeze scenarios

**Effort:** ⏱️ 1-2 hours (investigation + fixes)

---

### 5. Add Payment Failure Email Notifications 📧

**Issue:** Failed payments are logged but members may not be notified

**Current Behavior:**
- Failed payments logged in `payment_attempts` table
- Status updated to `past_due`
- No automatic email notification

**Fix Required:**
- Add email notification in `invoice.payment_failed` webhook handler
- Send to member's email
- Include payment failure details and retry information

**Files to Update:**
- `supabase/functions/stripe-webhook/index.ts` (invoice.payment_failed handler)
- Use existing `send-email` Edge Function

**Effort:** ⏱️ 1 hour

---

## 🟢 LOW PRIORITY ENHANCEMENTS

### 6. Payment Method Management UI 💳

**Enhancement:** Add UI for members to manage payment methods

**Features:**
- View saved payment methods
- Add new payment methods
- Set default payment method
- Remove payment methods
- Expiration warnings

**Effort:** ⏱️ 4-6 hours

---

### 7. Subscription Upgrade/Downgrade 📈

**Enhancement:** Allow members to change membership tiers

**Features:**
- Upgrade/downgrade tiers
- Handle proration correctly
- Update credits based on new tier
- Webhook processing for changes

**Effort:** ⏱️ 6-8 hours

---

### 8. Enhanced Payment Analytics 📊

**Enhancement:** Leverage existing payment tracking for analytics

**Features:**
- Payment metrics dashboard (already exists ✅)
- Subscription health monitoring
- Dunning efficiency reports
- Payment failure trends

**Effort:** ⏱️ 4-6 hours (mostly UI)

---

## 📋 Recommended Action Plan

### Phase 1: Critical Fixes (Do First)
1. ✅ Fix Guest Pass Price ID (10 min)
2. ⚠️ Decide on Annual Fee Strategy
   - If recurring: Implement annual fee subscriptions (2-3 hours)
   - If one-time: Keep current approach, document it

### Phase 2: Optimizations (Do Next)
3. 🔄 Eliminate Price ID Duplication (1-2 hours)
4. 📧 Add Payment Failure Email Notifications (1 hour)
5. 🔄 Review Freeze Integration (1-2 hours)

### Phase 3: Enhancements (Future)
6. 💳 Payment Method Management UI
7. 📈 Subscription Upgrade/Downgrade
8. 📊 Enhanced Analytics

---

## 🎯 Quick Wins (Do These First)

### 1. Fix Guest Pass Price ID ⏱️ 10 minutes
- **Impact:** Unblocks guest pass feature
- **Effort:** Very low
- **Risk:** None

### 2. Add Payment Failure Emails ⏱️ 1 hour
- **Impact:** Better member communication
- **Effort:** Low
- **Risk:** Low

---

## 🤔 Decision Needed

### Annual Fee Strategy

**Option A: Keep One-Time Payments** (Current)
- ✅ Simpler implementation
- ✅ Already working
- ❌ Manual work each year
- ❌ Risk of missing payments

**Option B: Make Annual Fees Recurring**
- ✅ Automatic renewal
- ✅ No manual work
- ✅ Better tracking
- ❌ More complex implementation
- ❌ Requires testing

**Recommendation:** If you have < 100 members, Option A is fine. If growing, consider Option B for scalability.

---

## 📝 Summary

**Must Fix (Blockers):**
1. Guest Pass Price ID

**Should Fix (High Value):**
2. Annual Fee Strategy (if choosing recurring)
3. Payment Failure Emails
4. Price ID Duplication

**Nice to Have:**
5. Payment Method Management UI
6. Subscription Upgrade/Downgrade
7. Enhanced Analytics

---

Would you like me to start with the quick wins (Guest Pass Price ID + Payment Failure Emails)?
