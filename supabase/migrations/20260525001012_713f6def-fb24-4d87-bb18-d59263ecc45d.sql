-- One-time backfill of payment_attempts.metadata.charge_type
-- to clearly separate initiation fee from membership dues in historical data.

-- 1) Initiation fee rows
UPDATE public.payment_attempts pa
SET metadata = COALESCE(pa.metadata, '{}'::jsonb) || jsonb_build_object('charge_type','initiation_fee')
FROM public.members m
WHERE pa.member_id = m.id
  AND (pa.metadata->>'charge_type') IS DISTINCT FROM 'initiation_fee'
  AND (
        (pa.stripe_subscription_id IS NOT NULL AND m.annual_fee_subscription_id IS NOT NULL
         AND pa.stripe_subscription_id = m.annual_fee_subscription_id)
     OR ((pa.metadata->>'description') ILIKE 'Initiation Fee%')
     OR pa.amount IN (300, 309.27, 175, 180.62)
  );

-- 2) Remaining member-linked subscription rows = membership dues
UPDATE public.payment_attempts pa
SET metadata = COALESCE(pa.metadata, '{}'::jsonb) || jsonb_build_object('charge_type','membership_dues')
FROM public.members m
WHERE pa.member_id = m.id
  AND (pa.metadata->>'charge_type') IS NULL
  AND (
        (pa.stripe_subscription_id IS NOT NULL AND m.stripe_subscription_id IS NOT NULL
         AND pa.stripe_subscription_id = m.stripe_subscription_id)
     OR ((pa.metadata->>'description') ILIKE 'Subscription%')
  );