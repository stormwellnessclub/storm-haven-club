CREATE OR REPLACE FUNCTION public.pt_reconcile_installment(
  p_subscription_id text,
  p_stripe_invoice_id text,
  p_outcome text,
  p_amount_cents integer DEFAULT NULL,
  p_payment_intent_id text DEFAULT NULL,
  p_failure_reason text DEFAULT NULL,
  p_occurred_at timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_ids uuid[];
  v_updated integer := 0;
BEGIN
  IF NOT public.pt_is_service_or_financial() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_subscription_id IS NULL OR p_stripe_invoice_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'subscription and invoice required');
  END IF;

  SELECT array_agg(id) INTO v_ids FROM public.pt_payment_plan_installments
   WHERE stripe_invoice_id = p_stripe_invoice_id;

  IF v_ids IS NULL THEN
    SELECT array_agg(pick) INTO v_ids FROM (
      SELECT DISTINCT ON (pass_id) id AS pick
        FROM public.pt_payment_plan_installments
       WHERE stripe_subscription_id = p_subscription_id
         AND installment_number > 0
         AND status IN ('scheduled','processing','failed','past_due')
       ORDER BY pass_id, installment_number
    ) s;
  END IF;

  IF v_ids IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'no open installment'); END IF;

  IF p_outcome = 'paid' THEN
    UPDATE public.pt_payment_plan_installments SET
      status = 'paid', paid_at = COALESCE(p_occurred_at, now()),
      stripe_invoice_id = p_stripe_invoice_id,
      stripe_payment_intent_id = COALESCE(p_payment_intent_id, stripe_payment_intent_id),
      last_failure_reason = NULL
    WHERE id = ANY(v_ids) AND status <> 'paid';
  ELSIF p_outcome = 'failed' THEN
    UPDATE public.pt_payment_plan_installments SET
      status = 'failed', failed_at = COALESCE(p_occurred_at, now()),
      attempt_count = CASE
        WHEN status = 'failed' AND stripe_invoice_id IS NOT DISTINCT FROM p_stripe_invoice_id
          THEN attempt_count ELSE attempt_count + 1 END,
      stripe_invoice_id = p_stripe_invoice_id,
      last_failure_reason = COALESCE(p_failure_reason, last_failure_reason)
    WHERE id = ANY(v_ids) AND status <> 'paid';
  ELSE
    UPDATE public.pt_payment_plan_installments SET
      status = p_outcome, stripe_invoice_id = p_stripe_invoice_id
    WHERE id = ANY(v_ids) AND status <> 'paid';
  END IF;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  UPDATE public.pt_passes p SET
    payment_plan_next_payment_date = agg.next_due,
    payment_plan_installments_paid = agg.paid_count,
    amount_paid_cents              = agg.paid_cents,
    amount_outstanding_cents       = GREATEST(agg.total_cents - agg.paid_cents, 0),
    payment_plan_status = CASE
      WHEN agg.open_count = 0 THEN 'completed'
      WHEN agg.failed_count > 0 THEN 'past_due'
      ELSE 'active' END,
    updated_at = now()
  FROM (
    SELECT i.pass_id,
           MIN(i.due_date) FILTER (WHERE i.status IN ('scheduled','processing','failed','past_due')) AS next_due,
           COUNT(*) FILTER (WHERE i.status = 'paid')                                                 AS paid_count,
           COALESCE(SUM(i.amount_cents) FILTER (WHERE i.status = 'paid'), 0)                         AS paid_cents,
           COALESCE(SUM(i.amount_cents), 0)                                                          AS total_cents,
           COUNT(*) FILTER (WHERE i.status IN ('scheduled','processing','failed','past_due'))        AS open_count,
           COUNT(*) FILTER (WHERE i.status IN ('failed','past_due'))                                 AS failed_count
      FROM public.pt_payment_plan_installments i
     WHERE i.pass_id IN (SELECT pass_id FROM public.pt_payment_plan_installments WHERE id = ANY(v_ids))
     GROUP BY i.pass_id
  ) agg
  WHERE p.id = agg.pass_id;

  RETURN jsonb_build_object('success', true, 'updated', v_updated, 'installment_ids', v_ids);
END; $$;