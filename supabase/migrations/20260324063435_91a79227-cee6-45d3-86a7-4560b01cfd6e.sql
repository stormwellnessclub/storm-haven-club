
-- Billing arrears ledger: tracks what each member owes by billing period
CREATE TABLE public.billing_arrears (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  billing_type text NOT NULL DEFAULT 'membership_dues', -- 'membership_dues', 'annual_fee', 'one_time'
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount_due_cents integer NOT NULL DEFAULT 0,
  amount_paid_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  stripe_invoice_id text,
  stripe_subscription_id text,
  stripe_payment_intent_id text,
  status text NOT NULL DEFAULT 'unpaid', -- 'unpaid', 'paid', 'partial', 'void', 'uncollectible', 'written_off'
  failure_code text,
  failure_message text,
  decline_code text,
  attempt_count integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(member_id, stripe_invoice_id)
);

-- Index for fast lookups
CREATE INDEX idx_billing_arrears_member_id ON public.billing_arrears(member_id);
CREATE INDEX idx_billing_arrears_status ON public.billing_arrears(status);
CREATE INDEX idx_billing_arrears_stripe_invoice ON public.billing_arrears(stripe_invoice_id);

-- RLS
ALTER TABLE public.billing_arrears ENABLE ROW LEVEL SECURITY;

-- Staff can see all arrears
CREATE POLICY "Staff can view all billing arrears"
  ON public.billing_arrears FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::public.app_role[]));

-- Staff can manage arrears
CREATE POLICY "Staff can manage billing arrears"
  ON public.billing_arrears FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::public.app_role[]));

-- Members can view their own arrears
CREATE POLICY "Members can view own billing arrears"
  ON public.billing_arrears FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM public.members WHERE user_id = auth.uid()
    )
  );

-- Summary function: returns arrears overview for a member
CREATE OR REPLACE FUNCTION public.get_member_arrears_summary(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_owed_cents integer;
  v_unpaid_count integer;
  v_unpaid_periods jsonb;
  v_latest_failure jsonb;
BEGIN
  -- Total owed
  SELECT COALESCE(SUM(amount_due_cents - amount_paid_cents), 0), COUNT(*)
  INTO v_total_owed_cents, v_unpaid_count
  FROM billing_arrears
  WHERE member_id = p_member_id
    AND status IN ('unpaid', 'partial');

  -- Unpaid periods detail
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'billing_type', billing_type,
      'period_start', period_start,
      'period_end', period_end,
      'amount_due_cents', amount_due_cents,
      'amount_paid_cents', amount_paid_cents,
      'status', status,
      'stripe_invoice_id', stripe_invoice_id,
      'failure_message', failure_message,
      'decline_code', decline_code,
      'attempt_count', attempt_count,
      'next_retry_at', next_retry_at,
      'created_at', created_at
    ) ORDER BY period_start DESC
  ), '[]'::jsonb)
  INTO v_unpaid_periods
  FROM billing_arrears
  WHERE member_id = p_member_id
    AND status IN ('unpaid', 'partial');

  -- Latest failure info
  SELECT jsonb_build_object(
    'failure_message', failure_message,
    'decline_code', decline_code,
    'attempt_count', attempt_count,
    'next_retry_at', next_retry_at,
    'stripe_invoice_id', stripe_invoice_id
  )
  INTO v_latest_failure
  FROM billing_arrears
  WHERE member_id = p_member_id
    AND status IN ('unpaid', 'partial')
    AND failure_message IS NOT NULL
  ORDER BY updated_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'total_owed_cents', v_total_owed_cents,
    'unpaid_count', v_unpaid_count,
    'unpaid_periods', v_unpaid_periods,
    'latest_failure', COALESCE(v_latest_failure, '{}'::jsonb)
  );
END;
$$;
