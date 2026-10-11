ALTER TABLE public.pt_sale_intents
  ADD COLUMN IF NOT EXISTS first_payment_override_cents integer,
  ADD COLUMN IF NOT EXISTS first_payment_method text,
  ADD COLUMN IF NOT EXISTS first_payment_reference text;
ALTER TABLE public.pt_payment_plan_installments
  ADD COLUMN IF NOT EXISTS paid_via text;

CREATE OR REPLACE FUNCTION public.pt_build_plan_schedule_v2(p_pack_id uuid, p_plan_id uuid, p_quantity integer, p_first_autopay date, p_sale_date date DEFAULT NULL, p_first_payment_cents integer DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_plan public.pt_pack_payment_plans%ROWTYPE;
  v_sale date := COALESCE(p_sale_date, (now() AT TIME ZONE 'America/Detroit')::date);
  v_q integer := GREATEST(COALESCE(p_quantity,1),1);
  v_dates date[]; v_rows jsonb; v_i integer; v_amt integer;
  v_total integer; v_plan_total integer; v_down integer; v_n integer; v_each integer; v_final integer;
BEGIN
  IF p_first_payment_cents IS NULL THEN
    RETURN public.pt_build_plan_schedule(p_pack_id, p_plan_id, p_quantity, p_first_autopay, p_sale_date);
  END IF;
  SELECT * INTO v_plan FROM public.pt_pack_payment_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment plan not found'; END IF;
  IF v_plan.pack_id <> p_pack_id THEN RAISE EXCEPTION 'Payment plan does not belong to this package'; END IF;
  IF NOT v_plan.is_active THEN RAISE EXCEPTION 'That payment plan is archived'; END IF;
  IF p_first_autopay IS NULL THEN RAISE EXCEPTION 'PT_AUTOPAY_DATE_INVALID: a first autopay date is required'; END IF;
  IF p_first_autopay <= v_sale THEN RAISE EXCEPTION 'PT_AUTOPAY_DATE_INVALID: the first autopay date must be after the sale date'; END IF;

  v_plan_total := v_plan.plan_total_cents * v_q;
  v_down := p_first_payment_cents;
  v_n := v_plan.future_installment_count;
  IF v_down < 0 OR v_down >= v_plan_total THEN
    RAISE EXCEPTION 'PT_AUTOPAY_DATE_INVALID: the first payment must be at least $0 and less than the plan total';
  END IF;
  IF v_n < 1 THEN RAISE EXCEPTION 'This plan has no future payments'; END IF;
  v_each := floor((v_plan_total - v_down)::numeric / v_n)::int;
  v_final := (v_plan_total - v_down) - v_each * (v_n - 1);

  v_dates := public.pt_plan_schedule_dates(p_first_autopay, v_plan.frequency_unit, v_plan.frequency_interval, v_n);
  v_total := v_down;
  v_rows := jsonb_build_array(jsonb_build_object('installment_number', 0, 'due_date', v_sale, 'amount_cents', v_down, 'status', 'due_now'));
  FOR v_i IN 1..v_n LOOP
    v_amt := CASE WHEN v_i = v_n THEN v_final ELSE v_each END;
    v_total := v_total + v_amt;
    v_rows := v_rows || jsonb_build_object('installment_number', v_i, 'due_date', v_dates[v_i], 'amount_cents', v_amt, 'status', 'scheduled');
  END LOOP;

  RETURN jsonb_build_object(
    'plan_id', v_plan.id, 'plan_name', v_plan.name,
    'sale_date', v_sale, 'first_autopay_date', p_first_autopay,
    'final_payment_date', v_dates[v_n],
    'intended_billing_day', EXTRACT(DAY FROM p_first_autopay)::int,
    'frequency_unit', v_plan.frequency_unit, 'frequency_interval', v_plan.frequency_interval,
    'installment_cents', v_each, 'final_installment_cents', v_final,
    'amount_due_at_sale_cents', v_down, 'future_installment_count', v_n,
    'first_payment_custom', true,
    'total_cents', v_total, 'quantity', v_q, 'installments', v_rows);
END; $function$;

CREATE OR REPLACE FUNCTION public.pt_plan_schedule_preview_v2(p_pack_id uuid, p_plan_id uuid, p_quantity integer, p_first_autopay date, p_first_payment_cents integer DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN public.pt_build_plan_schedule_v2(p_pack_id, p_plan_id, p_quantity, p_first_autopay, NULL, p_first_payment_cents);
END; $function$;
GRANT EXECUTE ON FUNCTION public.pt_plan_schedule_preview_v2(uuid, uuid, integer, date, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.pt_attach_plan_schedule(p_idempotency_key text, p_first_autopay date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_sale public.pt_sale_intents%ROWTYPE;
  v_sched jsonb;
BEGIN
  IF NOT public.pt_is_service_or_financial() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_sale FROM public.pt_sale_intents WHERE idempotency_key = p_idempotency_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF v_sale.payment_plan_template_id IS NULL THEN RAISE EXCEPTION 'This sale has no payment plan'; END IF;
  IF v_sale.planned_schedule IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'reused', true, 'schedule', v_sale.planned_schedule);
  END IF;
  v_sched := public.pt_build_plan_schedule_v2(
    v_sale.pack_id, v_sale.payment_plan_template_id, v_sale.quantity, p_first_autopay,
    (v_sale.created_at AT TIME ZONE 'America/Detroit')::date, v_sale.first_payment_override_cents);
  UPDATE public.pt_sale_intents SET
    planned_schedule = v_sched,
    first_installment_date = p_first_autopay,
    intended_billing_day = (v_sched ->> 'intended_billing_day')::int,
    final_payment_date = (v_sched ->> 'final_payment_date')::date,
    updated_at = now()
  WHERE id = v_sale.id;
  RETURN jsonb_build_object('success', true, 'reused', false, 'schedule', v_sched);
END; $function$;