-- Phase 2C.5B3: staff-side PT client billing account support.
-- Adds per-installment payment-method reference + reschedule provenance, and
-- authorized, audited RPCs for changing the future card and future due dates.

ALTER TABLE public.pt_payment_plan_installments
  ADD COLUMN IF NOT EXISTS payment_method_id text,
  ADD COLUMN IF NOT EXISTS payment_method_brand text,
  ADD COLUMN IF NOT EXISTS payment_method_last4 text,
  ADD COLUMN IF NOT EXISTS original_due_date date,
  ADD COLUMN IF NOT EXISTS rescheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS rescheduled_by uuid;

-- ---------------------------------------------------------------- card swap
CREATE OR REPLACE FUNCTION public.pt_plan_set_future_payment_method(
  p_pass_id uuid,
  p_payment_method_id text,
  p_brand text DEFAULT NULL,
  p_last4 text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_before jsonb;
  v_count int;
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to change payment methods';
  END IF;
  IF p_payment_method_id IS NULL OR length(trim(p_payment_method_id)) = 0 THEN
    RAISE EXCEPTION 'A payment method is required';
  END IF;

  SELECT user_id INTO v_user FROM public.pt_passes WHERE id = p_pass_id;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Package not found';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
           'installment_number', installment_number,
           'payment_method_id', payment_method_id,
           'brand', payment_method_brand,
           'last4', payment_method_last4))
    INTO v_before
    FROM public.pt_payment_plan_installments
   WHERE pass_id = p_pass_id AND status IN ('scheduled', 'failed', 'past_due');

  UPDATE public.pt_payment_plan_installments
     SET payment_method_id = p_payment_method_id,
         payment_method_brand = p_brand,
         payment_method_last4 = p_last4,
         updated_at = now()
   WHERE pass_id = p_pass_id
     AND status IN ('scheduled', 'failed', 'past_due');
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.pt_audit_log (entity_type, entity_id, client_user_id, action,
                                   changed_fields, before_data, after_data, actor_id)
  VALUES ('pt_payment_plan', p_pass_id, v_user, 'future_payment_method_changed',
          ARRAY['payment_method_id'], COALESCE(v_before, '[]'::jsonb),
          jsonb_build_object('payment_method_id', p_payment_method_id,
                             'brand', p_brand, 'last4', p_last4,
                             'installments_updated', v_count),
          auth.uid());

  RETURN jsonb_build_object('updated', v_count);
END;
$$;

-- ------------------------------------------------------------- reschedule
-- p_mode: 'one'    -> move only the selected unpaid installment
--         'future' -> move the selected installment and shift every later
--                     unpaid installment by the same number of days
-- p_apply false returns the proposed schedule without writing anything.
CREATE OR REPLACE FUNCTION public.pt_plan_reschedule(
  p_pass_id uuid,
  p_installment_number int,
  p_new_date date,
  p_mode text DEFAULT 'one',
  p_apply boolean DEFAULT false,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_target record;
  v_delta int;
  v_today date := (now() AT TIME ZONE 'America/Detroit')::date;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to change payment dates';
  END IF;
  IF p_mode NOT IN ('one', 'future') THEN
    RAISE EXCEPTION 'Unsupported reschedule mode';
  END IF;

  SELECT user_id INTO v_user FROM public.pt_passes WHERE id = p_pass_id;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Package not found';
  END IF;

  SELECT * INTO v_target
    FROM public.pt_payment_plan_installments
   WHERE pass_id = p_pass_id AND installment_number = p_installment_number;
  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'Installment not found';
  END IF;
  IF v_target.status <> 'scheduled' THEN
    RAISE EXCEPTION 'Only a scheduled installment can be moved (this one is %)', v_target.status;
  END IF;
  IF p_new_date IS NULL OR p_new_date <= v_today THEN
    RAISE EXCEPTION 'Choose a future date';
  END IF;

  v_delta := p_new_date - v_target.due_date;

  SELECT jsonb_agg(jsonb_build_object('installment_number', installment_number,
                                      'due_date', due_date,
                                      'amount_cents', amount_cents,
                                      'status', status) ORDER BY installment_number)
    INTO v_before
    FROM public.pt_payment_plan_installments
   WHERE pass_id = p_pass_id;

  SELECT jsonb_agg(jsonb_build_object(
           'installment_number', installment_number,
           'due_date', CASE
             WHEN status <> 'scheduled' THEN due_date
             WHEN installment_number = p_installment_number THEN p_new_date
             WHEN p_mode = 'future' AND installment_number > p_installment_number
               THEN due_date + v_delta
             ELSE due_date END,
           'amount_cents', amount_cents,
           'status', status) ORDER BY installment_number)
    INTO v_after
    FROM public.pt_payment_plan_installments
   WHERE pass_id = p_pass_id;

  IF NOT p_apply THEN
    RETURN jsonb_build_object('preview', true, 'current', v_before, 'proposed', v_after,
                              'delta_days', v_delta);
  END IF;

  UPDATE public.pt_payment_plan_installments
     SET original_due_date = COALESCE(original_due_date, due_date),
         due_date = CASE
           WHEN installment_number = p_installment_number THEN p_new_date
           ELSE due_date + v_delta END,
         rescheduled_at = now(),
         rescheduled_by = auth.uid(),
         updated_at = now()
   WHERE pass_id = p_pass_id
     AND status = 'scheduled'
     AND (installment_number = p_installment_number
          OR (p_mode = 'future' AND installment_number > p_installment_number));

  UPDATE public.pt_passes
     SET payment_plan_next_payment_date = (
           SELECT min(due_date) FROM public.pt_payment_plan_installments
            WHERE pass_id = p_pass_id AND status = 'scheduled'),
         updated_at = now()
   WHERE id = p_pass_id;

  INSERT INTO public.pt_audit_log (entity_type, entity_id, client_user_id, action,
                                   changed_fields, before_data, after_data, actor_id)
  VALUES ('pt_payment_plan', p_pass_id, v_user, 'installment_rescheduled',
          ARRAY['due_date'],
          jsonb_build_object('schedule', v_before),
          jsonb_build_object('schedule', v_after, 'mode', p_mode,
                             'delta_days', v_delta, 'reason', p_reason),
          auth.uid());

  RETURN jsonb_build_object('applied', true, 'current', v_before, 'proposed', v_after,
                            'delta_days', v_delta);
END;
$$;

REVOKE ALL ON FUNCTION public.pt_plan_set_future_payment_method(uuid, text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.pt_plan_reschedule(uuid, int, date, text, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.pt_plan_set_future_payment_method(uuid, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_plan_reschedule(uuid, int, date, text, boolean, text) TO authenticated, service_role;