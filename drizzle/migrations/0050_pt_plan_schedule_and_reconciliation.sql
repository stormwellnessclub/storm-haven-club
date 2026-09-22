-- Internal schedule builder (no auth gate; callers enforce their own).
CREATE OR REPLACE FUNCTION public.pt_build_plan_schedule(
  p_pack_id uuid, p_plan_id uuid, p_quantity integer, p_first_autopay date, p_sale_date date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_plan public.pt_pack_payment_plans%ROWTYPE;
  v_sale date := COALESCE(p_sale_date, (now() AT TIME ZONE 'America/Detroit')::date);
  v_q integer := GREATEST(COALESCE(p_quantity,1),1);
  v_dates date[];
  v_rows jsonb;
  v_i integer;
  v_amt integer;
  v_total integer;
BEGIN
  SELECT * INTO v_plan FROM public.pt_pack_payment_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment plan not found'; END IF;
  IF v_plan.pack_id <> p_pack_id THEN RAISE EXCEPTION 'Payment plan does not belong to this package'; END IF;
  IF NOT v_plan.is_active THEN RAISE EXCEPTION 'That payment plan is archived'; END IF;
  IF p_first_autopay IS NULL THEN RAISE EXCEPTION 'PT_AUTOPAY_DATE_INVALID: a first autopay date is required'; END IF;
  IF p_first_autopay <= v_sale THEN
    RAISE EXCEPTION 'PT_AUTOPAY_DATE_INVALID: the first autopay date must be after the sale date';
  END IF;

  v_dates := public.pt_plan_schedule_dates(
    p_first_autopay, v_plan.frequency_unit, v_plan.frequency_interval, v_plan.future_installment_count);

  v_total := v_plan.amount_due_at_sale_cents * v_q;
  v_rows := jsonb_build_array(jsonb_build_object(
    'installment_number', 0, 'due_date', v_sale,
    'amount_cents', v_plan.amount_due_at_sale_cents * v_q, 'status', 'due_now'));

  FOR v_i IN 1..v_plan.future_installment_count LOOP
    v_amt := CASE WHEN v_i = v_plan.future_installment_count
                  THEN v_plan.final_installment_cents ELSE v_plan.installment_cents END * v_q;
    v_total := v_total + v_amt;
    v_rows := v_rows || jsonb_build_object(
      'installment_number', v_i, 'due_date', v_dates[v_i], 'amount_cents', v_amt, 'status', 'scheduled');
  END LOOP;

  IF v_total <> v_plan.plan_total_cents * v_q THEN
    RAISE EXCEPTION 'PT_SCHEDULE_MISMATCH: schedule totals % but the plan totals %',
      v_total, v_plan.plan_total_cents * v_q;
  END IF;

  RETURN jsonb_build_object(
    'plan_id', v_plan.id, 'plan_name', v_plan.name,
    'sale_date', v_sale, 'first_autopay_date', p_first_autopay,
    'final_payment_date', v_dates[v_plan.future_installment_count],
    'intended_billing_day', EXTRACT(DAY FROM p_first_autopay)::int,
    'frequency_unit', v_plan.frequency_unit, 'frequency_interval', v_plan.frequency_interval,
    'installment_cents', v_plan.installment_cents * v_q,
    'final_installment_cents', v_plan.final_installment_cents * v_q,
    'amount_due_at_sale_cents', v_plan.amount_due_at_sale_cents * v_q,
    'future_installment_count', v_plan.future_installment_count,
    'total_cents', v_total, 'quantity', v_q, 'installments', v_rows);
END; $$;

CREATE OR REPLACE FUNCTION public.pt_plan_schedule_preview(
  p_pack_id uuid, p_plan_id uuid, p_quantity integer, p_first_autopay date, p_sale_date date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN public.pt_build_plan_schedule(p_pack_id, p_plan_id, p_quantity, p_first_autopay, p_sale_date);
END; $$;

-- Stores the authoritative schedule on the open sale intent before any money moves.
CREATE OR REPLACE FUNCTION public.pt_attach_plan_schedule(
  p_idempotency_key text, p_first_autopay date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_sale public.pt_sale_intents%ROWTYPE;
  v_sched jsonb;
BEGIN
  IF NOT public.pt_is_service_or_financial() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_sale FROM public.pt_sale_intents WHERE idempotency_key = p_idempotency_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF v_sale.payment_plan_template_id IS NULL THEN RAISE EXCEPTION 'This sale has no payment plan'; END IF;

  -- A schedule already stored on this sale is authoritative: retries never redate it.
  IF v_sale.planned_schedule IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'reused', true, 'schedule', v_sale.planned_schedule);
  END IF;

  v_sched := public.pt_build_plan_schedule(
    v_sale.pack_id, v_sale.payment_plan_template_id, v_sale.quantity, p_first_autopay,
    (v_sale.created_at AT TIME ZONE 'America/Detroit')::date);

  UPDATE public.pt_sale_intents SET
    planned_schedule = v_sched,
    first_installment_date = p_first_autopay,
    intended_billing_day = (v_sched ->> 'intended_billing_day')::int,
    final_payment_date = (v_sched ->> 'final_payment_date')::date,
    updated_at = now()
  WHERE id = v_sale.id;

  RETURN jsonb_build_object('success', true, 'reused', false, 'schedule', v_sched);
END; $$;

-- Single reconciliation path for Stripe installment outcomes. Idempotent on invoice id.
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

  -- Already reconciled for this invoice → update in place (duplicate webhook safe).
  SELECT array_agg(id) INTO v_ids FROM public.pt_payment_plan_installments
   WHERE stripe_invoice_id = p_stripe_invoice_id;

  IF v_ids IS NULL THEN
    -- Claim the earliest still-open installment per sold package on this subscription.
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
      stripe_invoice_id = p_stripe_invoice_id,
      attempt_count = attempt_count + 1,
      last_failure_reason = COALESCE(p_failure_reason, last_failure_reason)
    WHERE id = ANY(v_ids) AND status <> 'paid';
  ELSE
    UPDATE public.pt_payment_plan_installments SET
      status = p_outcome, stripe_invoice_id = p_stripe_invoice_id
    WHERE id = ANY(v_ids) AND status <> 'paid';
  END IF;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Keep the package's next-payment pointer on the real next scheduled date.
  UPDATE public.pt_passes p SET
    payment_plan_next_payment_date = (
      SELECT MIN(i.due_date) FROM public.pt_payment_plan_installments i
       WHERE i.pass_id = p.id AND i.status IN ('scheduled','processing','failed','past_due')),
    updated_at = now()
  WHERE p.stripe_subscription_id = p_subscription_id;

  RETURN jsonb_build_object('success', true, 'updated', v_updated, 'installment_ids', v_ids);
END; $$;