# Recurring Payment Subscription Status

## ✅ **Your membership subscriptions ARE fully recurring!**

---

## How Recurring Subscriptions Work

### 1. Subscription Creation ✅

**When a member activates their membership:**

```280:293:supabase/functions/stripe-payment/index.ts
          mode: 'subscription',
          subscription_data: {
            billing_cycle_anchor: billingAnchor,
            proration_behavior: 'none',
            metadata: {
              member_id: memberId,
              user_id: user.id,
              tier: normalizedTier,
              gender: normalizedGender,
              is_founding_member: String(isFoundingMember),
              start_date: startDate,
              annual_fee_skipped: String(skipAnnualFee || false),
            },
          },
```

- ✅ Creates a **recurring subscription** (not a one-time payment)
- ✅ Uses `mode: 'subscription'` - Stripe's recurring billing
- ✅ Sets `billing_cycle_anchor` to membership start date
- ✅ Supports both **monthly** and **annual** billing cycles

### 2. Price Configuration ✅

**Your Stripe prices are configured as recurring:**

- **Monthly subscriptions**: `price_1Sl9llLyZrsSqLhsJhm0MdJi` (Silver Women $200/mo)
- **Annual subscriptions**: `price_1Sl9x2LyZrsSqLhsYLtI7doB` (Silver Women $2,400/yr)

These are **recurring prices** in Stripe, which means:
- Stripe automatically charges them each billing period
- No manual intervention needed
- Automatic retry logic for failed payments

### 3. Automatic Renewals ✅

**Stripe automatically:**
1. Creates invoices on the billing date
2. Charges the saved payment method
3. Retries failed payments (up to 4 attempts)
4. Sends webhook events to your system

**No code changes needed** - this is Stripe's built-in functionality!

### 4. Webhook Processing ✅

**Your system handles renewals via webhooks:**

#### `invoice.payment_succeeded` (Renewal Success)
```631:732:supabase/functions/stripe-webhook/index.ts
      case 'invoice.payment_succeeded': {
        try {
          const invoice = event.data.object as Stripe.Invoice;
          logStep("Payment succeeded", { 
            invoiceId: invoice.id, 
            customerId: invoice.customer,
            subscriptionId: invoice.subscription
          });

          // Only process subscription invoices (skip one-time payments)
          if (!invoice.subscription) {
            logStep("Skipping non-subscription invoice", { invoiceId: invoice.id });
            break;
          }

          // Find member by subscription ID
          const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('id, status')
            .eq('stripe_subscription_id', invoice.subscription as string)
            .maybeSingle();

          if (memberError) {
            logError(memberError, "INVOICE_PAYMENT_SUCCEEDED_MEMBER_LOOKUP");
          } else if (memberData) {
            // Get payment intent and charge details
            const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent | string | null;
            const charge = invoice.charge as Stripe.Charge | string | null;
            
            let paymentIntentId: string | null = null;
            let chargeId: string | null = null;
            let paymentMethodId: string | null = null;
            let paymentMethodType: string | null = null;
            let cardBrand: string | null = null;
            let cardLast4: string | null = null;

            if (typeof paymentIntent === 'object' && paymentIntent) {
              paymentIntentId = paymentIntent.id;
              paymentMethodId = paymentIntent.payment_method as string | null;
              
              if (typeof charge === 'object' && charge && charge.payment_method_details) {
                chargeId = charge.id;
                if (charge.payment_method_details.type === 'card' && charge.payment_method_details.card) {
                  paymentMethodType = 'card';
                  cardBrand = charge.payment_method_details.card.brand || null;
                  cardLast4 = charge.payment_method_details.card.last4 || null;
                }
              }
            } else if (typeof paymentIntent === 'string') {
              paymentIntentId = paymentIntent;
            }

            if (typeof charge === 'string') {
              chargeId = charge;
            }

            // Log successful payment attempt
            const { error: logAttemptError } = await supabase.rpc('log_payment_attempt', {
              p_member_id: memberData.id,
              p_stripe_invoice_id: invoice.id,
              p_stripe_payment_intent_id: paymentIntentId,
              p_stripe_charge_id: chargeId,
              p_stripe_subscription_id: invoice.subscription as string,
              p_invoice_number: invoice.number || null,
              p_amount: invoice.amount_paid / 100, // Convert from cents
              p_currency: invoice.currency || 'usd',
              p_status: 'succeeded',
              p_attempt_number: invoice.attempt_count || 1,
              p_payment_method_id: paymentMethodId,
              p_payment_method_type: paymentMethodType,
              p_succeeded_at: new Date().toISOString(),
              p_metadata: {
                billing_reason: invoice.billing_reason,
                period_start: invoice.period_start,
                period_end: invoice.period_end,
                card_brand: cardBrand,
                card_last4: cardLast4
              }
            });

            if (logAttemptError) {
              logError(logAttemptError, "INVOICE_PAYMENT_SUCCEEDED_LOG");
            }

            // Update member status to active if it was past_due
            if (memberData.status === 'past_due') {
              const { error: updateError } = await supabase.rpc('update_subscription_status_with_history', {
                p_member_id: memberData.id,
                p_stripe_subscription_id: invoice.subscription as string,
                p_new_status: 'active',
                p_reason: 'payment_succeeded',
                p_stripe_event_id: event.id,
                p_changed_by: 'stripe',
                p_metadata: { invoice_id: invoice.id }
              });

              if (updateError) {
                logError(updateError, "INVOICE_PAYMENT_SUCCEEDED_STATUS_UPDATE");
              } else {
                logStep("Member status updated to active", { memberId: memberData.id });
              }
            }
```

**What happens:**
- ✅ Logs successful payment to `payment_attempts` table
- ✅ Updates member status from `past_due` to `active` (if applicable)
- ✅ Tracks payment method details

#### `invoice.payment_failed` (Renewal Failure)
```743:884:supabase/functions/stripe-webhook/index.ts
      case 'invoice.payment_failed': {
        try {
          const invoice = event.data.object as Stripe.Invoice;
          logStep("Payment failed", { 
            invoiceId: invoice.id, 
            customerId: invoice.customer,
            subscriptionId: invoice.subscription
          });

          // Only process subscription invoices
          if (!invoice.subscription) {
            logStep("Skipping non-subscription invoice", { invoiceId: invoice.id });
            break;
          }

          // Find member by subscription ID
          const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('id, status')
            .eq('stripe_subscription_id', invoice.subscription as string)
            .maybeSingle();

          if (memberError) {
            logError(memberError, "INVOICE_PAYMENT_FAILED_MEMBER_LOOKUP");
          } else if (memberData) {
            // Get payment intent and charge details for failure info
            const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent | string | null;
            const lastPaymentError = invoice.last_payment_error;
            
            let paymentIntentId: string | null = null;
            let chargeId: string | null = null;
            let paymentMethodId: string | null = null;
            let paymentMethodType: string | null = null;
            let failureCode: string | null = null;
            let failureMessage: string | null = null;
            let declineCode: string | null = null;
            let declineReason: string | null = null;
            let nextRetryAt: string | null = null;

            if (typeof paymentIntent === 'object' && paymentIntent) {
              paymentIntentId = paymentIntent.id;
              paymentMethodId = paymentIntent.payment_method as string | null;
              
              if (lastPaymentError) {
                failureCode = lastPaymentError.code || null;
                failureMessage = lastPaymentError.message || null;
                declineCode = lastPaymentError.decline_code || null;
              }
            } else if (typeof paymentIntent === 'string') {
              paymentIntentId = paymentIntent;
            }

            if (lastPaymentError) {
              declineReason = lastPaymentError.message || null;
            }

            if (invoice.next_payment_attempt) {
              nextRetryAt = new Date(invoice.next_payment_attempt * 1000).toISOString();
            }

            const attemptCount = invoice.attempt_count || 0;
            const willRetry = attemptCount < 4; // Stripe typically retries up to 4 times

            // Log failed payment attempt
            const { error: logAttemptError } = await supabase.rpc('log_payment_attempt', {
              p_member_id: memberData.id,
              p_stripe_invoice_id: invoice.id,
              p_stripe_payment_intent_id: paymentIntentId,
              p_stripe_charge_id: chargeId,
              p_stripe_subscription_id: invoice.subscription as string,
              p_invoice_number: invoice.number || null,
              p_amount: invoice.amount_due / 100, // Convert from cents
              p_currency: invoice.currency || 'usd',
              p_status: 'failed',
              p_attempt_number: attemptCount,
              p_payment_method_id: paymentMethodId,
              p_payment_method_type: paymentMethodType,
              p_failure_code: failureCode,
              p_failure_message: failureMessage,
              p_decline_code: declineCode,
              p_decline_reason: declineReason,
              p_retry_attempted: willRetry,
              p_next_retry_at: willRetry ? invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000).toISOString() : null : null,
              p_failed_at: new Date().toISOString(),
              p_metadata: {
                billing_reason: invoice.billing_reason,
                attempt_count: attemptCount,
                next_payment_attempt: invoice.next_payment_attempt
              }
            });

            if (logAttemptError) {
              logError(logAttemptError, "INVOICE_PAYMENT_FAILED_LOG");
            }

            // Update member status to past_due if payment failed and subscription is active
            if (memberData.status === 'active') {
              const { error: updateError } = await supabase.rpc('update_subscription_status_with_history', {
                p_member_id: memberData.id,
                p_stripe_subscription_id: invoice.subscription as string,
                p_new_status: 'past_due',
                p_reason: 'payment_failed',
                p_stripe_event_id: event.id,
                p_changed_by: 'stripe',
                p_metadata: { 
                  invoice_id: invoice.id,
                  failure_code: failureCode,
                  decline_code: declineCode,
                  attempt_count: attemptCount
                }
              });

              if (updateError) {
                logError(updateError, "INVOICE_PAYMENT_FAILED_STATUS_UPDATE");
              } else {
                logStep("Member status updated to past_due", { memberId: memberData.id });
              }
            }
```

**What happens:**
- ✅ Logs failed payment with failure details
- ✅ Updates member status from `active` to `past_due`
- ✅ Tracks retry attempts (Stripe retries up to 4 times)

### 5. Subscription Status Updates ✅

```527:587:supabase/functions/stripe-webhook/index.ts
      case 'customer.subscription.updated': {
        try {
          const subscription = event.data.object as Stripe.Subscription;
          logStep("Subscription updated", { 
            subscriptionId: subscription.id, 
            status: subscription.status 
          });

          // Find member by subscription ID
          const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('id, status')
            .eq('stripe_subscription_id', subscription.id)
            .maybeSingle();

          if (memberError) {
            logError(memberError, "SUBSCRIPTION_UPDATE_MEMBER_LOOKUP");
          } else if (memberData) {
            // Map Stripe subscription status to member status
            let newStatus: string;
            let reason: string;

            if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
              newStatus = 'past_due';
              reason = subscription.status === 'past_due' ? 'payment_past_due' : 'payment_unpaid';
            } else if (subscription.status === 'active') {
              newStatus = 'active';
              reason = 'subscription_active';
            } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
              newStatus = 'cancelled';
              reason = subscription.status === 'canceled' ? 'subscription_canceled' : 'subscription_unpaid';
            } else {
              // For other statuses (trialing, incomplete, etc.), keep current status or handle appropriately
              logStep("Subscription status not mapped", { status: subscription.status });
              break;
            }

            // Update status with history tracking
            const { error: updateError } = await supabase.rpc('update_subscription_status_with_history', {
              p_member_id: memberData.id,
              p_stripe_subscription_id: subscription.id,
              p_new_status: newStatus,
              p_reason: reason,
              p_stripe_event_id: event.id,
              p_changed_by: 'stripe',
              p_metadata: { subscription_status: subscription.status }
            });

            if (updateError) {
              logError(updateError, "SUBSCRIPTION_UPDATE_STATUS");
            } else {
              logStep("Subscription status updated", { memberId: memberData.id, newStatus, reason });
            }
          } else {
            logStep("Member not found for subscription", { subscriptionId: subscription.id });
          }
        } catch (subscriptionError) {
          logError(subscriptionError, "SUBSCRIPTION_UPDATED");
          return errorResponse(subscriptionError, "SUBSCRIPTION_UPDATED");
        }
        break;
      }
```

**What happens:**
- ✅ Syncs subscription status changes from Stripe
- ✅ Updates member status accordingly
- ✅ Maintains audit trail in `subscription_status_history`

---

## Summary

### ✅ What's Working:

1. **Recurring subscriptions are created correctly**
   - Using Stripe's subscription API
   - Monthly and annual billing cycles supported
   - Billing anchor set to membership start date

2. **Automatic renewals handled by Stripe**
   - Stripe automatically charges on billing date
   - Automatic retry logic for failed payments (up to 4 attempts)
   - No manual intervention needed

3. **Webhooks process renewals**
   - `invoice.payment_succeeded` logs successful renewals
   - `invoice.payment_failed` tracks failed payments
   - `customer.subscription.updated` syncs status changes

4. **Payment tracking**
   - All payment attempts logged in `payment_attempts` table
   - Status changes tracked in `subscription_status_history`
   - Full audit trail maintained

### ⚠️ One Issue Identified:

**Annual Fee is NOT recurring** - it's charged as a one-time payment in the activation checkout, but there's no separate recurring subscription for annual fees.

**This is separate from membership subscriptions** - your membership subscriptions ARE recurring, but the annual fee needs to be set up as its own recurring subscription if you want it to auto-renew each year.

---

## Verification

To verify your recurring subscriptions are working:

1. **Check Stripe Dashboard:**
   - Go to Subscriptions → Find a member's subscription
   - Check "Next payment" date - should be set correctly
   - Verify "Billing cycle" is monthly or annual

2. **Check Database:**
   ```sql
   SELECT 
     id, 
     first_name, 
     last_name,
     stripe_subscription_id,
     billing_type,
     status
   FROM members
   WHERE stripe_subscription_id IS NOT NULL;
   ```

3. **Check Webhook Events:**
   - Look for `invoice.payment_succeeded` events
   - Check `payment_attempts` table for logged payments

---

## Conclusion

**Your membership subscriptions ARE fully recurring!** ✅

Stripe automatically:
- Charges members on their billing date
- Retries failed payments
- Sends webhooks to your system
- Maintains subscription status

Your system:
- Processes webhook events correctly
- Updates member status
- Tracks all payment attempts
- Maintains audit trails

**No changes needed for membership subscriptions** - they're working as designed!

The only enhancement would be to make annual fees recurring (as a separate subscription), but membership dues are already set up correctly for automatic recurring billing.
