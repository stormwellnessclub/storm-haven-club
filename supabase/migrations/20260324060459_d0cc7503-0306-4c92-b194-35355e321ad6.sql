UPDATE public.members 
SET stripe_subscription_id = NULL, 
    subscription_status = NULL,
    updated_at = now()
WHERE id = '77150c1b-e358-4db0-9110-97078d1c59df';