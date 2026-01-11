-- Fix all members who are marked as 'active' but have not completed payments
-- This applies consistent rules to ALL members, not just specific accounts
UPDATE members 
SET status = 'pending_activation'
WHERE status = 'active'
  AND annual_fee_paid_at IS NULL 
  AND stripe_subscription_id IS NULL;