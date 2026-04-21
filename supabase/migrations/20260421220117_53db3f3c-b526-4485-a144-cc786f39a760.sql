
-- 1) Add missing columns to payment_attempts
ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS stripe_invoice_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_charge_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS payment_method_id text,
  ADD COLUMN IF NOT EXISTS payment_method_type text,
  ADD COLUMN IF NOT EXISTS retry_attempted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid,
  ADD COLUMN IF NOT EXISTS resolution_note text;

-- Backfill stripe_invoice_id from existing invoice_id text column (if any rows existed)
UPDATE public.payment_attempts
   SET stripe_invoice_id = invoice_id
 WHERE stripe_invoice_id IS NULL AND invoice_id IS NOT NULL;

-- 2) Indexes for the audit page + dedup lookups
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status_created
  ON public.payment_attempts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_member_created
  ON public.payment_attempts (member_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_attempts_charge
  ON public.payment_attempts (stripe_charge_id)
  WHERE stripe_charge_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_attempts_stripe_invoice
  ON public.payment_attempts (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_attempts_resolved
  ON public.payment_attempts (resolved_at)
  WHERE resolved_at IS NULL;

-- 3) Replace the broken log_payment_attempt with the full 21-param signature
-- Drop the old (12-arg) version explicitly so we don't end up with two overloads
DROP FUNCTION IF EXISTS public.log_payment_attempt(
  uuid, text, text, numeric, text, text, integer, text, text, text, text, timestamptz
);

CREATE OR REPLACE FUNCTION public.log_payment_attempt(
  p_member_id uuid,
  p_stripe_invoice_id text DEFAULT NULL,
  p_stripe_payment_intent_id text DEFAULT NULL,
  p_stripe_charge_id text DEFAULT NULL,
  p_stripe_subscription_id text DEFAULT NULL,
  p_invoice_number text DEFAULT NULL,
  p_amount numeric DEFAULT 0,
  p_currency text DEFAULT 'usd',
  p_status text DEFAULT 'pending',
  p_attempt_number integer DEFAULT 1,
  p_payment_method_id text DEFAULT NULL,
  p_payment_method_type text DEFAULT NULL,
  p_failure_code text DEFAULT NULL,
  p_failure_message text DEFAULT NULL,
  p_decline_code text DEFAULT NULL,
  p_decline_reason text DEFAULT NULL,
  p_retry_attempted boolean DEFAULT false,
  p_next_retry_at timestamptz DEFAULT NULL,
  p_succeeded_at timestamptz DEFAULT NULL,
  p_failed_at timestamptz DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Dedup by stripe_charge_id when present (most precise)
  IF p_stripe_charge_id IS NOT NULL THEN
    SELECT id INTO v_id
      FROM public.payment_attempts
     WHERE stripe_charge_id = p_stripe_charge_id
     LIMIT 1;
    IF v_id IS NOT NULL THEN
      UPDATE public.payment_attempts SET
        status = COALESCE(p_status, status),
        attempt_number = GREATEST(attempt_number, p_attempt_number),
        failure_code = COALESCE(p_failure_code, failure_code),
        failure_message = COALESCE(p_failure_message, failure_message),
        decline_code = COALESCE(p_decline_code, decline_code),
        decline_reason = COALESCE(p_decline_reason, decline_reason),
        next_retry_at = COALESCE(p_next_retry_at, next_retry_at),
        succeeded_at = COALESCE(p_succeeded_at, succeeded_at),
        failed_at = COALESCE(p_failed_at, failed_at),
        retry_attempted = COALESCE(p_retry_attempted, retry_attempted),
        metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb)
      WHERE id = v_id;
      RETURN v_id;
    END IF;
  END IF;

  -- Dedup by (invoice_id + status + attempt_number) for invoice-based events without a charge
  IF p_stripe_invoice_id IS NOT NULL AND p_status IS NOT NULL THEN
    SELECT id INTO v_id
      FROM public.payment_attempts
     WHERE stripe_invoice_id = p_stripe_invoice_id
       AND status = p_status
       AND COALESCE(attempt_number,1) = COALESCE(p_attempt_number,1)
     LIMIT 1;
    IF v_id IS NOT NULL THEN
      UPDATE public.payment_attempts SET
        stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
        stripe_charge_id = COALESCE(p_stripe_charge_id, stripe_charge_id),
        stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
        payment_method_id = COALESCE(p_payment_method_id, payment_method_id),
        payment_method_type = COALESCE(p_payment_method_type, payment_method_type),
        failure_code = COALESCE(p_failure_code, failure_code),
        failure_message = COALESCE(p_failure_message, failure_message),
        decline_code = COALESCE(p_decline_code, decline_code),
        decline_reason = COALESCE(p_decline_reason, decline_reason),
        next_retry_at = COALESCE(p_next_retry_at, next_retry_at),
        succeeded_at = COALESCE(p_succeeded_at, succeeded_at),
        failed_at = COALESCE(p_failed_at, failed_at),
        retry_attempted = COALESCE(p_retry_attempted, retry_attempted),
        metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb)
      WHERE id = v_id;
      RETURN v_id;
    END IF;
  END IF;

  INSERT INTO public.payment_attempts (
    member_id,
    invoice_id,
    invoice_number,
    stripe_invoice_id,
    stripe_payment_intent_id,
    stripe_charge_id,
    stripe_subscription_id,
    payment_method_id,
    payment_method_type,
    amount,
    currency,
    status,
    attempt_number,
    failure_code,
    failure_message,
    decline_code,
    decline_reason,
    retry_attempted,
    next_retry_at,
    succeeded_at,
    failed_at,
    metadata
  ) VALUES (
    p_member_id,
    p_stripe_invoice_id,
    p_invoice_number,
    p_stripe_invoice_id,
    p_stripe_payment_intent_id,
    p_stripe_charge_id,
    p_stripe_subscription_id,
    p_payment_method_id,
    p_payment_method_type,
    p_amount,
    COALESCE(p_currency, 'usd'),
    p_status,
    COALESCE(p_attempt_number, 1),
    p_failure_code,
    p_failure_message,
    p_decline_code,
    p_decline_reason,
    COALESCE(p_retry_attempted, false),
    p_next_retry_at,
    p_succeeded_at,
    p_failed_at,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_payment_attempt(
  uuid, text, text, text, text, text, numeric, text, text, integer,
  text, text, text, text, text, text, boolean, timestamptz, timestamptz, timestamptz, jsonb
) TO authenticated, service_role;

-- 4) Reconciliation log table for the daily health check
CREATE TABLE IF NOT EXISTS public.payment_tracking_health_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  stripe_failed_count integer NOT NULL DEFAULT 0,
  db_failed_count integer NOT NULL DEFAULT 0,
  stripe_succeeded_count integer NOT NULL DEFAULT 0,
  db_succeeded_count integer NOT NULL DEFAULT 0,
  drift integer NOT NULL DEFAULT 0,
  alert_sent boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_tracking_health_log_checked_at
  ON public.payment_tracking_health_log (checked_at DESC);

ALTER TABLE public.payment_tracking_health_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view payment tracking health log"
  ON public.payment_tracking_health_log;
CREATE POLICY "Staff can view payment tracking health log"
  ON public.payment_tracking_health_log
  FOR SELECT
  TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));

-- service_role bypasses RLS for inserts from edge functions (no INSERT policy needed)
