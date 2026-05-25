CREATE TABLE public.billing_outreach_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  arrears_id UUID REFERENCES public.billing_arrears(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('call','sms','email','in_person','other')),
  outcome TEXT NOT NULL CHECK (outcome IN ('left_message','reached_member','payment_promised','card_update_requested','resolved','no_response','other')),
  note TEXT,
  follow_up_at TIMESTAMPTZ,
  outstanding_at_contact_cents INTEGER,
  months_behind_at_contact INTEGER,
  created_by UUID,
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_outreach_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all outreach logs"
ON public.billing_outreach_logs FOR SELECT
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));

CREATE POLICY "Admins can insert outreach logs"
ON public.billing_outreach_logs FOR INSERT
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));

CREATE POLICY "Admins can update outreach logs"
ON public.billing_outreach_logs FOR UPDATE
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

CREATE POLICY "Super admins can delete outreach logs"
ON public.billing_outreach_logs FOR DELETE
USING (public.has_any_role(auth.uid(), ARRAY['super_admin']::app_role[]));

CREATE INDEX idx_billing_outreach_member ON public.billing_outreach_logs(member_id, created_at DESC);
CREATE INDEX idx_billing_outreach_followup ON public.billing_outreach_logs(follow_up_at) WHERE follow_up_at IS NOT NULL;

CREATE TRIGGER update_billing_outreach_updated_at
  BEFORE UPDATE ON public.billing_outreach_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();