-- B2: Storm owns the dated installment schedule for PT payment plans.

ALTER TABLE public.pt_sale_intents
  ADD COLUMN IF NOT EXISTS planned_schedule jsonb NULL,
  ADD COLUMN IF NOT EXISTS intended_billing_day integer NULL,
  ADD COLUMN IF NOT EXISTS final_payment_date date NULL;

ALTER TABLE public.pt_passes
  ADD COLUMN IF NOT EXISTS first_autopay_date date NULL,
  ADD COLUMN IF NOT EXISTS final_payment_date date NULL,
  ADD COLUMN IF NOT EXISTS intended_billing_day integer NULL;

CREATE TABLE IF NOT EXISTS public.pt_payment_plan_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id uuid NOT NULL REFERENCES public.pt_passes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  sale_intent_id uuid NULL REFERENCES public.pt_sale_intents(id) ON DELETE SET NULL,
  payment_plan_template_id uuid NULL REFERENCES public.pt_pack_payment_plans(id) ON DELETE RESTRICT,
  stripe_subscription_id text NULL,
  installment_number integer NOT NULL,
  due_date date NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  status text NOT NULL DEFAULT 'scheduled',
  paid_at timestamptz NULL,
  failed_at timestamptz NULL,
  stripe_invoice_id text NULL,
  stripe_payment_intent_id text NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  last_failure_reason text NULL,
  dunning_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pt_installment_status_valid CHECK (status IN
    ('scheduled','processing','paid','failed','past_due','voided','refunded')),
  CONSTRAINT pt_installment_unique_number UNIQUE (pass_id, installment_number)
);

GRANT SELECT ON public.pt_payment_plan_installments TO authenticated;
GRANT ALL ON public.pt_payment_plan_installments TO service_role;

ALTER TABLE public.pt_payment_plan_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients read their own installments"
  ON public.pt_payment_plan_installments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.pt_is_financial_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_pt_installments_pass ON public.pt_payment_plan_installments(pass_id);
CREATE INDEX IF NOT EXISTS idx_pt_installments_sub ON public.pt_payment_plan_installments(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_pt_installments_due ON public.pt_payment_plan_installments(due_date) WHERE status IN ('scheduled','processing','failed','past_due');
CREATE UNIQUE INDEX IF NOT EXISTS idx_pt_installments_invoice ON public.pt_payment_plan_installments(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.pt_touch_installment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_pt_installment_touch ON public.pt_payment_plan_installments;
CREATE TRIGGER trg_pt_installment_touch BEFORE UPDATE ON public.pt_payment_plan_installments
  FOR EACH ROW EXECUTE FUNCTION public.pt_touch_installment();

-- Deterministic America/Detroit business dates. Monthly keeps the intended billing
-- day and clamps only in short months, returning to the intended day afterwards.
CREATE OR REPLACE FUNCTION public.pt_plan_schedule_dates(
  p_first date, p_unit text, p_interval integer, p_count integer
) RETURNS date[]
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_out date[] := '{}';
  v_day integer := EXTRACT(DAY FROM p_first)::int;
  v_base date := date_trunc('month', p_first)::date;
  v_month date;
  v_last integer;
  v_i integer;
  v_step integer := GREATEST(COALESCE(p_interval,1), 1);
BEGIN
  IF p_count IS NULL OR p_count <= 0 THEN RETURN v_out; END IF;
  FOR v_i IN 0..(p_count - 1) LOOP
    IF p_unit = 'month' THEN
      v_month := (v_base + (v_i * v_step) * INTERVAL '1 month')::date;
      v_last := EXTRACT(DAY FROM (date_trunc('month', v_month) + INTERVAL '1 month - 1 day'))::int;
      v_out := v_out || (date_trunc('month', v_month)::date + (LEAST(v_day, v_last) - 1));
    ELSIF p_unit = 'week' THEN
      v_out := v_out || (p_first + (v_i * v_step * 7));
    ELSE
      v_out := v_out || (p_first + (v_i * v_step));
    END IF;
  END LOOP;
  RETURN v_out;
END; $$;

-- Storm computes and stores the exact schedule on the sale intent BEFORE any money moves.
CREATE OR REPLACE FUNCTION public.pt_plan_schedule_preview(
  p_pack_id uuid, p_plan_id uuid, p_quantity integer, p_first_autopay date, p_sale_date date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_plan public.pt_pack_payment_plans%ROWTYPE;
  v_pack public.pt_packs%ROWTYPE;
  v_sale date := COALESCE(p_sale_date, (now() AT TIME ZONE 'America/Detroit')::date);
  v_q integer := GREATEST(COALESCE(p_quantity,1),1);
  v_dates date[];
  v_rows jsonb := '[]'::jsonb;
  v_i integer;
  v_amt integer;
  v_total integer;
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_pack FROM public.pt_packs WHERE id = p_pack_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Package not found'; END IF;
  SELECT * INTO v_plan FROM public.pt_pack_payment_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment plan not found'; END IF;
  IF v_plan.pack_id <> v_pack.id THEN RAISE EXCEPTION 'Payment plan does not belong to this package'; END IF;
  IF NOT v_plan.is_active THEN RAISE EXCEPTION 'That payment plan is archived'; END IF;
  IF p_first_autopay IS NULL THEN RAISE EXCEPTION 'A first autopay date is required'; END IF;
  IF p_first_autopay <= v_sale THEN
    RAISE EXCEPTION 'PT_AUTOPAY_DATE_INVALID: the first autopay date must be after the sale date';
  END IF;

  v_dates := public.pt_plan_schedule_dates(
    p_first_autopay, v_plan.frequency_unit, v_plan.frequency_interval, v_plan.future_installment_count);

  v_rows := jsonb_build_array(jsonb_build_object(
    'installment_number', 0, 'due_date', v_sale,
    'amount_cents', v_plan.amount_due_at_sale_cents * v_q, 'status', 'due_now'));
  v_total := v_plan.amount_due_at_sale_cents * v_q;

  FOR v_i IN 1..v_plan.future_installment_count LOOP
    v_amt := CASE WHEN v_i = v_plan.future_installment_count
                  THEN v_plan.final_installment_cents ELSE v_plan.installment_cents END * v_q;
    v_total := v_total + v_amt;
    v_rows := v_rows || jsonb_build_object(
      'installment_number', v_i, 'due_date', v_dates[v_i],
      'amount_cents', v_amt, 'status', 'scheduled');
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
    'amount_due_at_sale_cents', v_plan.amount_due_at_sale_cents * v_q,
    'future_installment_count', v_plan.future_installment_count,
    'total_cents', v_total, 'quantity', v_q, 'installments', v_rows);
END; $$;

-- Materializes the stored schedule onto the sold agreement. Idempotent.
CREATE OR REPLACE FUNCTION public.pt_materialize_plan_installments(
  p_idempotency_key text, p_subscription_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_sale public.pt_sale_intents%ROWTYPE;
  v_pass public.pt_passes%ROWTYPE;
  v_item jsonb;
  v_n integer := 0;
BEGIN
  IF NOT public.pt_is_service_or_financial() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_sale FROM public.pt_sale_intents WHERE idempotency_key = p_idempotency_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF v_sale.planned_schedule IS NULL THEN
    RETURN jsonb_build_object('success', true, 'installments', 0, 'note', 'no plan schedule on this sale');
  END IF;

  FOR v_pass IN SELECT * FROM public.pt_passes WHERE id = ANY(COALESCE(v_sale.pass_ids, '{}')) LOOP
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_sale.planned_schedule -> 'installments') LOOP
      INSERT INTO public.pt_payment_plan_installments (
        pass_id, user_id, sale_intent_id, payment_plan_template_id, stripe_subscription_id,
        installment_number, due_date, amount_cents, status, paid_at, stripe_payment_intent_id
      ) VALUES (
        v_pass.id, v_pass.user_id, v_sale.id, v_sale.payment_plan_template_id,
        COALESCE(p_subscription_id, v_sale.stripe_subscription_id),
        (v_item ->> 'installment_number')::int,
        (v_item ->> 'due_date')::date,
        ((v_item ->> 'amount_cents')::int) / GREATEST(COALESCE(v_sale.quantity,1),1),
        CASE WHEN (v_item ->> 'installment_number')::int = 0 THEN 'paid' ELSE 'scheduled' END,
        CASE WHEN (v_item ->> 'installment_number')::int = 0 THEN COALESCE(v_sale.paid_at, now()) END,
        CASE WHEN (v_item ->> 'installment_number')::int = 0 THEN v_sale.stripe_payment_intent_id END
      )
      ON CONFLICT (pass_id, installment_number) DO UPDATE
        SET stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id,
                                              public.pt_payment_plan_installments.stripe_subscription_id);
      v_n := v_n + 1;
    END LOOP;

    UPDATE public.pt_passes SET
      first_autopay_date = (v_sale.planned_schedule ->> 'first_autopay_date')::date,
      final_payment_date = (v_sale.planned_schedule ->> 'final_payment_date')::date,
      intended_billing_day = (v_sale.planned_schedule ->> 'intended_billing_day')::int,
      payment_plan_next_payment_date = (v_sale.planned_schedule ->> 'first_autopay_date')::date,
      updated_at = now()
    WHERE id = v_pass.id;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'installments', v_n);
END; $$;