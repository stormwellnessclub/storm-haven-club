# Annual Fee Recurring Subscription Implementation

## Strategy

Since Stripe Checkout Sessions with multiple line items create ONE subscription (not separate), we'll:
1. Create membership subscription via Checkout (without annual fee line item)
2. After checkout completes, create annual fee subscription separately via Subscription API (in webhook)
3. Store `annual_fee_subscription_id` in members table
4. Handle annual fee subscription renewals in webhook

## Implementation Steps

1. **Update `create_activation_checkout`:**
   - Remove annual fee from line items
   - Keep metadata about annual fee (for webhook)

2. **Update `checkout.session.completed` webhook handler:**
   - After membership subscription is created, create annual fee subscription
   - Store `annual_fee_subscription_id` in members table

3. **Update `create_subscription_from_payment`:**
   - Create membership subscription
   - Create annual fee subscription separately
   - Store both subscription IDs

4. **Update `invoice.payment_succeeded` webhook:**
   - Handle annual fee subscription renewals
   - Update `annual_fee_paid_at` when annual fee subscription invoices are paid
