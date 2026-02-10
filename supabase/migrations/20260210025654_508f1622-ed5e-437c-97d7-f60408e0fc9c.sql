UPDATE members 
SET subscription_status = 'none',
    stripe_subscription_id = NULL,
    annual_fee_subscription_id = NULL,
    updated_at = now()
WHERE email = 'fatima.baydoun236@gmail.com';