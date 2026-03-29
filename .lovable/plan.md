

# Fix Ayah Boussi's Subscription Status

## Summary
Update Ayah Boussi's database record to reflect her successful Stripe payment, and investigate the webhook gap.

## Steps

### 1. Update Ayah Boussi's member record
Use the database insert tool to run:
```sql
UPDATE members 
SET subscription_status = 'active', 
    status = 'active',
    updated_at = NOW()
WHERE id = '41757422-e546-4a78-997b-79eadb548280';
```

### 2. Verify her Stripe subscription ID is stored
Check if `stripe_subscription_id` is populated. If not, retrieve it from Stripe and update the record so future webhooks sync correctly.

### 3. Investigate webhook gap
- Review the `stripe-webhook` edge function logs to see if the `invoice.payment_succeeded` event for her latest invoice was received
- Check if the webhook handler skipped the update because `subscription_status` was already `incomplete_expired` (a terminal state the handler may not attempt to recover from)
- If a logic gap is found, add a fix so that a successful payment on a previously-incomplete subscription correctly transitions the status to `active`

### 4. Optional: webhook resilience improvement
If the investigation confirms the webhook missed the transition, add handling in the `invoice.payment_succeeded` webhook path to clear `incomplete_expired` status when a payment succeeds for that customer.

