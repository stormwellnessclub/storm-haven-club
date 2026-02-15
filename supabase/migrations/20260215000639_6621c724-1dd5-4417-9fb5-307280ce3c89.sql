
-- Add follow-up columns to guest_passes
ALTER TABLE public.guest_passes ADD COLUMN IF NOT EXISTS follow_up_status text;
ALTER TABLE public.guest_passes ADD COLUMN IF NOT EXISTS follow_up_notes text;

-- Create promo campaign log table
CREATE TABLE IF NOT EXISTS public.promo_campaign_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by uuid REFERENCES auth.users(id),
  credits_allocated integer NOT NULL DEFAULT 0,
  members_skipped integer NOT NULL DEFAULT 0,
  members_errored integer NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_campaign_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view promo campaigns"
ON public.promo_campaign_log FOR SELECT
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

CREATE POLICY "Admins can insert promo campaigns"
ON public.promo_campaign_log FOR INSERT
TO authenticated
WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));
