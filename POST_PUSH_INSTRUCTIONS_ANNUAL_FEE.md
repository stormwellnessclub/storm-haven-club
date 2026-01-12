# Post-Push Instructions - Annual Fee Recurring Subscriptions

## Changes Pushed ✅

Successfully pushed implementation of annual fee recurring subscriptions.

## ⚠️ Important: Testing Required

After the push, you need to test the new implementation to ensure everything works correctly.

### 1. Test Checkout Flow (New Activation)

**What to Test:**
- Activate a new membership via Checkout
- Verify that only the membership subscription is created (not annual fee as a line item)
- Verify that annual fee subscription is created separately after checkout

**How to Test:**
1. Go through the activation flow for a new member
2. Complete the Stripe Checkout
3. Check Stripe Dashboard:
   - Should see TWO subscriptions for the member:
     - Membership subscription (monthly or annual)
     - Annual fee subscription (yearly)
4. Check Database:
   - `members.stripe_subscription_id` should have membership subscription ID
   - `members.annual_fee_subscription_id` should have annual fee subscription ID
   - `members.annual_fee_paid_at` should be set to activation date

### 2. Test Embedded Payment Flow (New Activation)

**What to Test:**
- Activate a new membership via embedded payment form
- Verify both subscriptions are created

**How to Test:**
1. Go through the activation flow using embedded payment
2. Complete payment
3. Check Stripe Dashboard for both subscriptions
4. Check Database for both subscription IDs

### 3. Verify Existing Members Are Not Affected

**What to Verify:**
- Existing members should continue to work normally
- Existing members without annual fee subscriptions should NOT be affected
- Only new activations will have annual fee subscriptions

### 4. Monitor Webhook Logs

**What to Monitor:**
- Check Supabase Edge Function logs for `stripe-webhook`
- Look for any errors during checkout completion
- Verify annual fee subscription creation logs appear

**How to Monitor:**
1. Go to Supabase Dashboard → Edge Functions → `stripe-webhook`
2. Check logs after a test activation
3. Look for:
   - `[STRIPE-WEBHOOK] Creating annual fee subscription`
   - `[STRIPE-WEBHOOK] Annual fee subscription created`

### 5. Test Annual Fee Renewal (Future)

**Note:** This test can only be done when a renewal actually occurs (or use Stripe test mode to simulate)

**What to Test:**
- Annual fee subscription automatically renews
- `annual_fee_paid_at` is updated on renewal
- Payment is logged in `payment_attempts` table

**How to Test (Stripe Test Mode):**
1. Use Stripe Dashboard to manually trigger invoice payment for annual fee subscription
2. Check webhook logs for `invoice.payment_succeeded`
3. Verify `annual_fee_paid_at` is updated in database

## 🔧 Potential Issues to Watch For

### Issue 1: Annual Fee Subscription Not Created

**Symptom:** Only membership subscription created, no annual fee subscription

**Possible Causes:**
- Webhook not processing correctly
- Missing payment method on membership subscription
- Error in webhook handler

**How to Fix:**
- Check webhook logs for errors
- Verify payment method exists on membership subscription
- Check Stripe Dashboard for webhook delivery

### Issue 2: Duplicate Subscriptions

**Symptom:** Multiple annual fee subscriptions created

**Possible Causes:**
- Webhook called multiple times
- Retry logic creating duplicates

**How to Fix:**
- Check webhook idempotency
- Verify webhook is only called once per checkout session

### Issue 3: Annual Fee Not Renewing

**Symptom:** Annual fee subscription not renewing after 1 year

**Possible Causes:**
- Subscription not set up correctly
- Payment method expired
- Webhook not handling renewals

**How to Fix:**
- Check subscription status in Stripe Dashboard
- Verify payment method is valid
- Check webhook logs for renewal events

## 📋 Checklist

- [ ] Test new member activation via Checkout
- [ ] Verify both subscriptions created in Stripe
- [ ] Verify both subscription IDs in database
- [ ] Test new member activation via embedded payment
- [ ] Check webhook logs for any errors
- [ ] Verify existing members are not affected
- [ ] Monitor first few activations closely

## 🎯 Success Criteria

✅ New activations create two separate subscriptions  
✅ Both subscription IDs stored in database  
✅ Annual fee subscription set to renew yearly  
✅ No errors in webhook logs  
✅ Existing members continue to work normally  

## 📞 Next Steps

After testing:
1. Monitor first few activations in production
2. Check Stripe Dashboard for subscription creation
3. Verify webhook logs are clean
4. Document any issues found

## ⚠️ Rollback Plan (If Needed)

If issues are found:

1. **Immediate:** Monitor webhook errors closely
2. **If Critical:** Revert the commit and redeploy
3. **If Minor:** Fix specific issues in webhook handler

The changes are backwards compatible - existing members are not affected, only new activations use the new flow.
