
CREATE TABLE public.sms_marketing_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  email text,
  source text NOT NULL DEFAULT 'homepage',
  consent_given boolean NOT NULL DEFAULT true,
  consent_version text,
  consent_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.sms_marketing_leads TO anon;
GRANT INSERT, SELECT ON public.sms_marketing_leads TO authenticated;
GRANT ALL ON public.sms_marketing_leads TO service_role;

ALTER TABLE public.sms_marketing_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit an SMS lead"
ON public.sms_marketing_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view SMS leads"
ON public.sms_marketing_leads
FOR SELECT
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[])
);

CREATE INDEX idx_sms_marketing_leads_created_at ON public.sms_marketing_leads(created_at DESC);
CREATE INDEX idx_sms_marketing_leads_phone ON public.sms_marketing_leads(phone);
