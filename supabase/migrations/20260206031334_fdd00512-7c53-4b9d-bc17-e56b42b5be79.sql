-- Create card setup attempts audit table
CREATE TABLE public.card_setup_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  application_id UUID REFERENCES public.membership_applications(id) ON DELETE SET NULL,
  stripe_customer_id TEXT NOT NULL,
  stripe_setup_intent TEXT,
  source TEXT NOT NULL CHECK (source IN ('self_service', 'admin_portal', 'checkout_link', 'member_portal')),
  initiated_by UUID,
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'succeeded', 'failed', 'abandoned')),
  decline_code TEXT,
  decline_message TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for quick lookups
CREATE INDEX idx_card_setup_attempts_customer ON public.card_setup_attempts(stripe_customer_id);
CREATE INDEX idx_card_setup_attempts_setup_intent ON public.card_setup_attempts(stripe_setup_intent);
CREATE INDEX idx_card_setup_attempts_status ON public.card_setup_attempts(status);
CREATE INDEX idx_card_setup_attempts_created ON public.card_setup_attempts(created_at DESC);

-- RLS policy for admins only
ALTER TABLE public.card_setup_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view card setup attempts"
  ON public.card_setup_attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

CREATE POLICY "System can insert card setup attempts"
  ON public.card_setup_attempts
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update card setup attempts"
  ON public.card_setup_attempts
  FOR UPDATE
  USING (true);