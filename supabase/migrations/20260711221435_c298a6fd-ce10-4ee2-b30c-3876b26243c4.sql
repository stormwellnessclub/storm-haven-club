CREATE TABLE public.monthly_credit_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  user_id UUID,
  stripe_invoice_id TEXT NOT NULL,
  stripe_subscription_id TEXT,
  credit_type public.credit_type NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  member_credit_id UUID REFERENCES public.member_credits(id) ON DELETE SET NULL,
  cycle_start DATE NOT NULL,
  cycle_end DATE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL DEFAULT 'stripe_webhook',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stripe_invoice_id, credit_type)
);

GRANT ALL ON public.monthly_credit_grants TO service_role;

ALTER TABLE public.monthly_credit_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages monthly credit grants"
ON public.monthly_credit_grants
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_monthly_credit_grants_updated_at
BEFORE UPDATE ON public.monthly_credit_grants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.grant_monthly_membership_credit(
  p_member_id UUID,
  p_user_id UUID,
  p_stripe_invoice_id TEXT,
  p_stripe_subscription_id TEXT,
  p_credit_type public.credit_type,
  p_amount INTEGER,
  p_cycle_start DATE,
  p_cycle_end DATE,
  p_expires_at TIMESTAMPTZ,
  p_source TEXT DEFAULT 'stripe_webhook',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grant_id UUID;
  v_credit_id UUID;
  v_existing_credit public.member_credits%ROWTYPE;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'member_id_required');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_id_required');
  END IF;

  IF p_stripe_invoice_id IS NULL OR btrim(p_stripe_invoice_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'stripe_invoice_id_required');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'no_credit_amount');
  END IF;

  IF p_cycle_start IS NULL OR p_cycle_end IS NULL OR p_expires_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'cycle_dates_required');
  END IF;

  IF p_expires_at <= v_now THEN
    p_cycle_start := v_now::date;
    p_cycle_end := (v_now::date + interval '30 days')::date;
    p_expires_at := (p_cycle_end::timestamp + interval '23 hours 59 minutes 59 seconds') AT TIME ZONE 'UTC';
  END IF;

  INSERT INTO public.monthly_credit_grants (
    member_id,
    user_id,
    stripe_invoice_id,
    stripe_subscription_id,
    credit_type,
    amount,
    cycle_start,
    cycle_end,
    expires_at,
    source,
    metadata
  ) VALUES (
    p_member_id,
    p_user_id,
    p_stripe_invoice_id,
    p_stripe_subscription_id,
    p_credit_type,
    p_amount,
    p_cycle_start,
    p_cycle_end,
    p_expires_at,
    COALESCE(NULLIF(btrim(p_source), ''), 'stripe_webhook'),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (stripe_invoice_id, credit_type) DO NOTHING
  RETURNING id INTO v_grant_id;

  IF v_grant_id IS NULL THEN
    SELECT member_credit_id INTO v_credit_id
    FROM public.monthly_credit_grants
    WHERE stripe_invoice_id = p_stripe_invoice_id
      AND credit_type = p_credit_type;

    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'member_credit_id', v_credit_id
    );
  END IF;

  SELECT * INTO v_existing_credit
  FROM public.member_credits
  WHERE user_id = p_user_id
    AND credit_type = p_credit_type
    AND cycle_start = p_cycle_start
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.member_credits
    SET credits_total = credits_total + p_amount,
        credits_remaining = credits_remaining + p_amount,
        cycle_end = GREATEST(cycle_end, p_cycle_end),
        expires_at = GREATEST(expires_at, p_expires_at),
        updated_at = v_now
    WHERE id = v_existing_credit.id
    RETURNING id INTO v_credit_id;
  ELSE
    INSERT INTO public.member_credits (
      user_id,
      member_id,
      credit_type,
      credits_total,
      credits_remaining,
      cycle_start,
      cycle_end,
      expires_at
    ) VALUES (
      p_user_id,
      p_member_id,
      p_credit_type,
      p_amount,
      p_amount,
      p_cycle_start,
      p_cycle_end,
      p_expires_at
    )
    ON CONFLICT (user_id, credit_type, cycle_start) DO UPDATE
    SET credits_total = public.member_credits.credits_total + EXCLUDED.credits_total,
        credits_remaining = public.member_credits.credits_remaining + EXCLUDED.credits_remaining,
        cycle_end = GREATEST(public.member_credits.cycle_end, EXCLUDED.cycle_end),
        expires_at = GREATEST(public.member_credits.expires_at, EXCLUDED.expires_at),
        updated_at = v_now
    RETURNING id INTO v_credit_id;
  END IF;

  UPDATE public.monthly_credit_grants
  SET member_credit_id = v_credit_id,
      updated_at = v_now
  WHERE id = v_grant_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'grant_id', v_grant_id,
    'member_credit_id', v_credit_id,
    'amount', p_amount,
    'credit_type', p_credit_type,
    'cycle_start', p_cycle_start,
    'cycle_end', p_cycle_end
  );
EXCEPTION
  WHEN OTHERS THEN
    IF v_grant_id IS NOT NULL THEN
      DELETE FROM public.monthly_credit_grants WHERE id = v_grant_id;
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_monthly_membership_credit(UUID, UUID, TEXT, TEXT, public.credit_type, INTEGER, DATE, DATE, TIMESTAMPTZ, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_monthly_membership_credit(UUID, UUID, TEXT, TEXT, public.credit_type, INTEGER, DATE, DATE, TIMESTAMPTZ, TEXT, JSONB) TO service_role;