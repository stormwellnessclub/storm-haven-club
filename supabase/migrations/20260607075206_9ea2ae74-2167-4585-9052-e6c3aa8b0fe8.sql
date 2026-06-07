CREATE TABLE public.card_expiry_notices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT NOT NULL,
  card_last4 TEXT,
  exp_month INTEGER NOT NULL,
  exp_year INTEGER NOT NULL,
  days_out INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email','sms')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, stripe_payment_method_id, exp_month, exp_year, days_out, channel)
);

CREATE INDEX idx_card_expiry_notices_member ON public.card_expiry_notices(member_id);
CREATE INDEX idx_card_expiry_notices_sent_at ON public.card_expiry_notices(sent_at DESC);

GRANT SELECT ON public.card_expiry_notices TO authenticated;
GRANT ALL ON public.card_expiry_notices TO service_role;

ALTER TABLE public.card_expiry_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view card expiry notices"
  ON public.card_expiry_notices
  FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[]));