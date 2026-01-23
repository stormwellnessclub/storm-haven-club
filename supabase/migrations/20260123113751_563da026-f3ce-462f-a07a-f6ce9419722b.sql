-- =============================================
-- SECURITY HARDENING MIGRATION (Fixed v2)
-- Phase 1-3: Critical and High Priority Fixes
-- =============================================

-- 1. Enable RLS on processed_webhook_events with deny-all policy
ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- 2. Fix scheduled_functions_config - make anon_key nullable first, then clear it
ALTER TABLE public.scheduled_functions_config ALTER COLUMN anon_key DROP NOT NULL;
ALTER TABLE public.scheduled_functions_config ALTER COLUMN anon_key DROP DEFAULT;
UPDATE public.scheduled_functions_config SET anon_key = NULL WHERE anon_key IS NOT NULL;

-- 3. Create public view for instructors (without contact info)
CREATE OR REPLACE VIEW public.public_instructors_view 
WITH (security_invoker = true)
AS
SELECT 
  id,
  first_name,
  last_name,
  bio,
  photo_url,
  specialties,
  is_active,
  created_at
FROM public.instructors
WHERE is_active = true;

-- Update instructors RLS: restrict contact info to staff only
DROP POLICY IF EXISTS "Anyone can view active instructors" ON public.instructors;

CREATE POLICY "Staff can view all instructor details"
ON public.instructors FOR SELECT
USING (
  has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role])
);

GRANT SELECT ON public.public_instructors_view TO authenticated, anon;

-- 4. Harden membership_applications email policy
DROP POLICY IF EXISTS "Users can view their own applications" ON public.membership_applications;

CREATE POLICY "Users can view their own applications"
ON public.membership_applications FOR SELECT
USING (
  user_id = auth.uid()
  OR has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role])
);

-- 5. Harden member_activities INSERT policy
DROP POLICY IF EXISTS "System can insert activities" ON public.member_activities;

CREATE POLICY "No direct inserts allowed"
ON public.member_activities FOR INSERT
WITH CHECK (false);

CREATE POLICY "Staff can insert activities"
ON public.member_activities FOR INSERT
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role])
);

-- 6. Create limited view for front_desk role (using actual columns)
CREATE OR REPLACE VIEW public.member_limited_view
WITH (security_invoker = true)
AS
SELECT 
  m.id,
  m.member_id,
  m.first_name,
  m.last_name,
  m.email,
  m.phone,
  m.photo_url,
  m.status,
  m.membership_type,
  m.membership_start_date,
  m.membership_end_date,
  m.is_founding_member,
  m.gender,
  m.activated_at,
  m.created_at,
  m.updated_at
  -- Excludes: stripe_customer_id, stripe_subscription_id, annual_fee_subscription_id,
  -- billing_type, annual_fee_paid_at, locked_start_date, card_brand, card_last4, 
  -- card_exp_month, card_exp_year
FROM public.members m;

GRANT SELECT ON public.member_limited_view TO authenticated;

COMMENT ON VIEW public.member_limited_view IS 'Limited member view for front_desk role - excludes Stripe and payment details';
COMMENT ON VIEW public.public_instructors_view IS 'Public instructor view - excludes contact information (email, phone)';