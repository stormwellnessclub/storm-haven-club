CREATE OR REPLACE FUNCTION public.pt_build_custom_plan_schedule(
  p_total_cents integer, p_installment_count integer, p_first_autopay date,
  p_sale_date date DEFAULT NULL, p_first_payment_cents integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sale date := COALESCE(p_sale_date, (now() AT TIME ZONE 'America/Detroit')::date);
  v_dates date[]; v_rows jsonb; v_i integer; v_amt integer;
  v_total integer; v_down integer; v_n integer; v_each integer; v_final integer;
BEGIN
  IF p_total_cents IS NULL OR p_total_cents <= 0 THEN
    RAISE EXCEPTION 'PT_AUTOPAY_DATE_INVALID: the plan total must be more than $0';
  END IF;
  IF p_installment_count IS NULL OR p_installment_count < 2 OR p_installment_count > 24 THEN
    RAISE EXCEPTION 'PT_AUTOPAY_DATE_INVALID: the number of months must be between 2 and 24';
  END IF;
  IF p_first_autopay IS NULL THEN RAISE EXCEPTION 'PT_AUTOPAY_DATE_INVALID: a first autopay date is required'; END IF;
  IF p_first_autopay <= v_sale THEN RAISE EXCEPTION 'PT_AUTOPAY_DATE_INVALID: the first autopay date must be after the sale date'; END IF;

  v_n := p_installment_count - 1;
  v_down := COALESCE(p_first_payment_cents, floor(p_total_cents::numeric / p_installment_count)::int);
  IF v_down < 0 OR v_down >= p_total_cents THEN
    RAISE EXCEPTION 'PT_AUTOPAY_DATE_INVALID: the first payment must be at least $0 and less than the plan total';
  END IF;
  v_each := floor((p_total_cents - v_down)::numeric / v_n)::int;
  v_final := (p_total_cents - v_down) - v_each * (v_n - 1);

  v_dates := public.pt_plan_schedule_dates(p_first_autopay, 'month', 1, v_n);
  v_total := v_down;
  v_rows := jsonb_build_array(jsonb_build_object('installment_number', 0, 'due_date', v_sale, 'amount_cents', v_down, 'status', 'due_now'));
  FOR v_i IN 1..v_n LOOP
    v_amt := CASE WHEN v_i = v_n THEN v_final ELSE v_each END;
    v_total := v_total + v_amt;
    v_rows := v_rows || jsonb_build_object('installment_number', v_i, 'due_date', v_dates[v_i], 'amount_cents', v_amt, 'status', 'scheduled');
  END LOOP;

  RETURN jsonb_build_object(
    'plan_id', NULL, 'plan_name', 'Custom ' || p_installment_count || '-month plan',
    'sale_date', v_sale, 'first_autopay_date', p_first_autopay,
    'final_payment_date', v_dates[v_n],
    'intended_billing_day', EXTRACT(DAY FROM p_first_autopay)::int,
    'frequency_unit', 'month', 'frequency_interval', 1,
    'installment_cents', v_each, 'final_installment_cents', v_final,
    'amount_due_at_sale_cents', v_down, 'future_installment_count', v_n,
    'first_payment_custom', true, 'installment_count_custom', true, 'custom_plan', true,
    'total_cents', v_total, 'quantity', 1, 'installments', v_rows);
END; $function$;

REVOKE ALL ON FUNCTION public.pt_build_custom_plan_schedule(integer, integer, date, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_build_custom_plan_schedule(integer, integer, date, date, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pt_custom_plan_schedule_preview(
  p_total_cents integer, p_installment_count integer, p_first_autopay date,
  p_first_payment_cents integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN public.pt_build_custom_plan_schedule(p_total_cents, p_installment_count, p_first_autopay, NULL, p_first_payment_cents);
END; $function$;

REVOKE ALL ON FUNCTION public.pt_custom_plan_schedule_preview(integer, integer, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_custom_plan_schedule_preview(integer, integer, date, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pt_attach_plan_schedule(p_idempotency_key text, p_first_autopay date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sale public.pt_sale_intents%ROWTYPE;
  v_sched jsonb;
BEGIN
  IF NOT public.pt_is_service_or_financial() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_sale FROM public.pt_sale_intents WHERE idempotency_key = p_idempotency_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF v_sale.planned_schedule IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'reused', true, 'schedule', v_sale.planned_schedule);
  END IF;

  -- Custom plan: no preset template; total is this sale's own (possibly adjusted) price.
  IF v_sale.payment_plan_template_id IS NULL THEN
    IF v_sale.installment_count_override IS NULL THEN RAISE EXCEPTION 'This sale has no payment plan'; END IF;
    v_sched := public.pt_build_custom_plan_schedule(
      v_sale.unit_price_cents * GREATEST(COALESCE(v_sale.quantity,1),1),
      v_sale.installment_count_override, p_first_autopay,
      (v_sale.created_at AT TIME ZONE 'America/Detroit')::date, v_sale.first_payment_override_cents);
    UPDATE public.pt_sale_intents SET
      planned_schedule = v_sched,
      first_installment_date = p_first_autopay,
      intended_billing_day = (v_sched ->> 'intended_billing_day')::int,
      final_payment_date = (v_sched ->> 'final_payment_date')::date,
      payment_plan_name_snapshot = v_sched ->> 'plan_name',
      plan_total_cents = (v_sched ->> 'total_cents')::int,
      amount_due_at_sale_cents = (v_sched ->> 'amount_due_at_sale_cents')::int,
      future_installment_count = (v_sched ->> 'future_installment_count')::int,
      final_installment_cents = (v_sched ->> 'final_installment_cents')::int,
      installment_cents = (v_sched ->> 'installment_cents')::int,
      installment_count = v_sale.installment_count_override,
      amount_due_today_cents = (v_sched ->> 'amount_due_at_sale_cents')::int,
      frequency_unit = 'month',
      frequency_interval = 1,
      updated_at = now()
    WHERE id = v_sale.id;
    RETURN jsonb_build_object('success', true, 'reused', false, 'schedule', v_sched);
  END IF;

  IF v_sale.price_override_cents IS NOT NULL THEN
    RAISE EXCEPTION 'PT_AUTOPAY_DATE_INVALID: a changed price needs a custom payment plan, not a preset plan';
  END IF;

  v_sched := public.pt_build_plan_schedule_v3(
    v_sale.pack_id, v_sale.payment_plan_template_id, v_sale.quantity, p_first_autopay,
    (v_sale.created_at AT TIME ZONE 'America/Detroit')::date, v_sale.first_payment_override_cents,
    v_sale.installment_count_override);
  UPDATE public.pt_sale_intents SET
    planned_schedule = v_sched,
    first_installment_date = p_first_autopay,
    intended_billing_day = (v_sched ->> 'intended_billing_day')::int,
    final_payment_date = (v_sched ->> 'final_payment_date')::date,
    amount_due_at_sale_cents = CASE WHEN v_sale.installment_count_override IS NOT NULL THEN (v_sched ->> 'amount_due_at_sale_cents')::int ELSE amount_due_at_sale_cents END,
    future_installment_count = CASE WHEN v_sale.installment_count_override IS NOT NULL THEN (v_sched ->> 'future_installment_count')::int ELSE future_installment_count END,
    final_installment_cents = CASE WHEN v_sale.installment_count_override IS NOT NULL THEN (v_sched ->> 'final_installment_cents')::int ELSE final_installment_cents END,
    installment_cents = CASE WHEN v_sale.installment_count_override IS NOT NULL THEN (v_sched ->> 'installment_cents')::int ELSE installment_cents END,
    installment_count = CASE WHEN v_sale.installment_count_override IS NOT NULL THEN v_sale.installment_count_override ELSE installment_count END,
    amount_due_today_cents = CASE WHEN v_sale.installment_count_override IS NOT NULL THEN (v_sched ->> 'amount_due_at_sale_cents')::int ELSE amount_due_today_cents END,
    updated_at = now()
  WHERE id = v_sale.id;
  RETURN jsonb_build_object('success', true, 'reused', false, 'schedule', v_sched);
END; $function$;