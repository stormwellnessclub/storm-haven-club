CREATE TABLE public.member_billing_snapshot (
  member_id uuid PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  stripe_customer_id text,
  dues_subscription_id text,
  dues_status text,
  annual_subscription_id text,
  annual_status text,
  effective_status text,
  collection_paused boolean NOT NULL DEFAULT false,
  resumes_at timestamptz,
  next_billing_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  last_paid_at timestamptz,
  last_paid_amount_cents integer,
  last_failed_at timestamptz,
  last_failed_amount_cents integer,
  amount_due_cents integer,
  card_brand text,
  card_last4 text,
  card_exp_month integer,
  card_exp_year integer,
  anomalies text[] NOT NULL DEFAULT '{}',
  sync_error text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.member_billing_snapshot TO authenticated;
GRANT ALL ON public.member_billing_snapshot TO service_role;

ALTER TABLE public.member_billing_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view billing snapshots"
  ON public.member_billing_snapshot FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_member_billing_snapshot_updated_at
  BEFORE UPDATE ON public.member_billing_snapshot
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_member_billing_snapshot_effective_status
  ON public.member_billing_snapshot(effective_status);