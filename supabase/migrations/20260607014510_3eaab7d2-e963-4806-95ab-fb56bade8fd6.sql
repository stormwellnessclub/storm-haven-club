
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS payment_past_due boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_past_due_since timestamptz;

CREATE INDEX IF NOT EXISTS idx_members_payment_past_due
  ON public.members(payment_past_due)
  WHERE payment_past_due = true;

CREATE OR REPLACE FUNCTION public.is_member_past_due(p_member_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT payment_past_due FROM public.members WHERE id = p_member_id),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_member_past_due(uuid) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.payment_dunning_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  stripe_invoice_id text NOT NULL,
  stripe_subscription_id text,
  stripe_customer_id text,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  failure_reason text,
  failure_code text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'recovered', 'abandoned')),
  first_failed_at timestamptz NOT NULL DEFAULT now(),
  recovered_at timestamptz,
  abandoned_at timestamptz,
  last_retry_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0,
  emails_sent jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_email_day integer,
  next_email_due_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, stripe_invoice_id)
);

GRANT SELECT ON public.payment_dunning_state TO authenticated;
GRANT ALL ON public.payment_dunning_state TO service_role;

ALTER TABLE public.payment_dunning_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own dunning state"
  ON public.payment_dunning_state
  FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM public.members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all dunning state"
  ON public.payment_dunning_state
  FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager']::public.app_role[])
  );

CREATE INDEX IF NOT EXISTS idx_payment_dunning_state_member ON public.payment_dunning_state(member_id);
CREATE INDEX IF NOT EXISTS idx_payment_dunning_state_status ON public.payment_dunning_state(status);
CREATE INDEX IF NOT EXISTS idx_payment_dunning_state_invoice ON public.payment_dunning_state(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_dunning_state_next_email
  ON public.payment_dunning_state(next_email_due_at)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.update_payment_dunning_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_dunning_state_updated_at ON public.payment_dunning_state;
CREATE TRIGGER trg_payment_dunning_state_updated_at
  BEFORE UPDATE ON public.payment_dunning_state
  FOR EACH ROW EXECUTE FUNCTION public.update_payment_dunning_updated_at();
