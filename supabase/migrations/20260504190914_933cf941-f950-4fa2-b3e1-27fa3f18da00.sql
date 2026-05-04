
CREATE TABLE public.sms_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name text NOT NULL,
  campaign_type text NOT NULL CHECK (campaign_type IN ('guest','member')),
  body text NOT NULL,
  media_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  media_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  goal_type text,
  goal_metadata jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sms_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.sms_campaigns(id) ON DELETE CASCADE,
  recipient_user_id uuid,
  phone text,
  recipient_name text,
  status text NOT NULL,
  twilio_sid text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sms_campaign_recipients_campaign ON public.sms_campaign_recipients(campaign_id);
CREATE INDEX idx_sms_campaigns_goal_type ON public.sms_campaigns(goal_type) WHERE goal_type IS NOT NULL;

ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage sms_campaigns" ON public.sms_campaigns
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[]));

CREATE POLICY "Staff manage sms_campaign_recipients" ON public.sms_campaign_recipients
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[]));
