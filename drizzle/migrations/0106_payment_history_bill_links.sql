-- Payment history keeps its link to the bill (Oct 2026).
--
-- The nightly billing rebuild saved dues payments without their Stripe bill (it
-- read charge.invoice, which the Stripe API version it used no longer sends). The
-- rule that links a failure to the later payment matches by bill, so those
-- failures never resolved. When the webhook later recorded the same payment,
-- log_payment_attempt found the row by charge id but never filled in the bill.
--
-- This migration changes no existing record. It:
--   1. adds link_failures_to_payment(attempt): for a successful payment with a
--      bill, resolve that bill's earlier failures, mark the month paid and close
--      its reminders (the existing guards then clear the past-due flag);
--   2. makes log_payment_attempt fill in a missing bill, subscription, payment
--      intent and invoice number on an existing row, and link the bill's
--      failures when a bill becomes known for a successful payment;
--   3. adds payment_history_cleanup_backup for the admin-approved cleanup of the
--      rows the rebuild copied in by mistake (run from the Billing Arrears page).

-- 1. One place that links a successful payment to its bill's failures ─────────

CREATE OR REPLACE FUNCTION public.link_failures_to_payment(p_attempt_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.payment_attempts%ROWTYPE;
  v_linked integer := 0;
BEGIN
  SELECT * INTO v_row FROM public.payment_attempts WHERE id = p_attempt_id;
  IF NOT FOUND OR v_row.status <> 'succeeded' OR v_row.stripe_invoice_id IS NULL OR v_row.member_id IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.payment_attempts
  SET superseded_by_attempt_id = v_row.id,
      superseded_at = COALESCE(superseded_at, now()),
      resolved_at = COALESCE(resolved_at, now()),
      resolution_note = COALESCE(resolution_note, 'superseded_by_payment')
  WHERE member_id = v_row.member_id
    AND stripe_invoice_id = v_row.stripe_invoice_id
    AND id <> v_row.id
    AND status IN ('failed', 'requires_action')
    AND (superseded_at IS NULL OR resolved_at IS NULL);
  GET DIAGNOSTICS v_linked = ROW_COUNT;

  UPDATE public.billing_arrears
  SET status = 'paid',
      amount_paid_cents = GREATEST(COALESCE(amount_paid_cents, 0), amount_due_cents),
      paid_at = COALESCE(paid_at, v_row.succeeded_at, now()),
      next_retry_at = NULL,
      updated_at = now()
  WHERE member_id = v_row.member_id
    AND stripe_invoice_id = v_row.stripe_invoice_id
    AND status IN ('unpaid', 'partial')
    AND reopened_at IS NULL;

  -- Recovered reminders re-evaluate the member's past-due flag and status
  -- (trigger trg_payment_dunning_reevaluate_past_due).
  UPDATE public.payment_dunning_state
  SET status = 'recovered', recovered_at = COALESCE(recovered_at, now()), updated_at = now()
  WHERE member_id = v_row.member_id
    AND stripe_invoice_id = v_row.stripe_invoice_id
    AND status = 'active';

  RETURN v_linked;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_failures_to_payment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_failures_to_payment(uuid) TO service_role;

-- 2. log_payment_attempt: complete the bill link on existing rows ──────────────
-- Same signature and behavior as before, except that a row found by charge id
-- now gains any bill / subscription / payment intent / invoice number it lacked,
-- and a successful payment is linked to its bill's failures.

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
  v_status text;
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
        stripe_invoice_id = COALESCE(stripe_invoice_id, p_stripe_invoice_id),
        invoice_id = COALESCE(invoice_id, p_stripe_invoice_id),
        invoice_number = COALESCE(invoice_number, p_invoice_number),
        stripe_subscription_id = COALESCE(stripe_subscription_id, p_stripe_subscription_id),
        stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, p_stripe_payment_intent_id),
        failure_code = COALESCE(p_failure_code, failure_code),
        failure_message = COALESCE(p_failure_message, failure_message),
        decline_code = COALESCE(p_decline_code, decline_code),
        decline_reason = COALESCE(p_decline_reason, decline_reason),
        next_retry_at = COALESCE(p_next_retry_at, next_retry_at),
        succeeded_at = COALESCE(p_succeeded_at, succeeded_at),
        failed_at = COALESCE(p_failed_at, failed_at),
        retry_attempted = COALESCE(p_retry_attempted, retry_attempted),
        metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb)
      WHERE id = v_id
      RETURNING status INTO v_status;
      IF v_status = 'succeeded' THEN
        PERFORM public.link_failures_to_payment(v_id);
      END IF;
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

REVOKE EXECUTE ON FUNCTION public.log_payment_attempt(uuid, text, text, text, text, text, numeric, text, text, integer, text, text, text, text, text, text, boolean, timestamptz, timestamptz, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_payment_attempt(uuid, text, text, text, text, text, numeric, text, text, integer, text, text, text, text, text, text, boolean, timestamptz, timestamptz, timestamptz, jsonb) TO service_role;

-- 3. Backup of rows removed by the payment-history cleanup ─────────────────────

CREATE TABLE IF NOT EXISTS public.payment_history_cleanup_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  removed_at timestamptz NOT NULL DEFAULT now(),
  removed_by uuid,
  run_id uuid REFERENCES public.billing_reconciliation_runs(id) ON DELETE SET NULL,
  reason text NOT NULL,
  original_row jsonb NOT NULL
);

ALTER TABLE public.payment_history_cleanup_backup ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Finance staff read payment history cleanup backup" ON public.payment_history_cleanup_backup;
CREATE POLICY "Finance staff read payment history cleanup backup"
  ON public.payment_history_cleanup_backup FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

COMMENT ON TABLE public.payment_history_cleanup_backup IS
  'Rows removed from payment_attempts by the admin-approved cleanup (non-bill charges the nightly rebuild copied in). Restorable from original_row.';
