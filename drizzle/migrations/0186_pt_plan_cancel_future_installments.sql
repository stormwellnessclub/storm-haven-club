CREATE OR REPLACE FUNCTION public.pt_plan_cancel_future_installments(
  p_pass_id uuid, p_installment_numbers integer[], p_reason text, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid;
  v_before jsonb;
  v_after jsonb;
  v_count int;
  v_left int;
BEGIN
  IF NOT public.has_any_role(p_actor, ARRAY['admin','super_admin']::app_role[]) THEN
    RAISE EXCEPTION 'Only an admin can cancel future payments';
  END IF;
  IF coalesce(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Please give a reason';
  END IF;
  IF p_installment_numbers IS NULL OR array_length(p_installment_numbers, 1) IS NULL THEN
    RAISE EXCEPTION 'Choose at least one payment';
  END IF;

  SELECT user_id INTO v_user FROM public.pt_passes WHERE id = p_pass_id;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Package not found'; END IF;

  IF EXISTS (SELECT 1 FROM public.pt_payment_plan_installments
              WHERE pass_id = p_pass_id AND installment_number = ANY(p_installment_numbers)
                AND status <> 'scheduled') THEN
    RAISE EXCEPTION 'Only upcoming payments that have not been charged can be cancelled';
  END IF;

  SELECT jsonb_agg(jsonb_build_object('installment_number', installment_number, 'due_date', due_date,
                   'amount_cents', amount_cents, 'status', status) ORDER BY installment_number)
    INTO v_before FROM public.pt_payment_plan_installments WHERE pass_id = p_pass_id;

  UPDATE public.pt_payment_plan_installments
     SET status = 'voided', updated_at = now()
   WHERE pass_id = p_pass_id AND status = 'scheduled'
     AND installment_number = ANY(p_installment_numbers);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  SELECT count(*) INTO v_left FROM public.pt_payment_plan_installments
   WHERE pass_id = p_pass_id AND status = 'scheduled';

  UPDATE public.pt_passes
     SET payment_plan_next_payment_date = (SELECT min(due_date) FROM public.pt_payment_plan_installments
                                            WHERE pass_id = p_pass_id AND status = 'scheduled'),
         payment_plan_status = CASE WHEN v_left = 0 THEN 'cancelled' ELSE payment_plan_status END,
         updated_at = now()
   WHERE id = p_pass_id;

  SELECT jsonb_agg(jsonb_build_object('installment_number', installment_number, 'due_date', due_date,
                   'amount_cents', amount_cents, 'status', status) ORDER BY installment_number)
    INTO v_after FROM public.pt_payment_plan_installments WHERE pass_id = p_pass_id;

  INSERT INTO public.pt_audit_log (entity_type, entity_id, client_user_id, action,
                                   changed_fields, before_data, after_data, actor_id)
  VALUES ('pt_payment_plan', p_pass_id, v_user, 'installments_cancelled', ARRAY['status'],
          jsonb_build_object('schedule', v_before),
          jsonb_build_object('schedule', v_after, 'cancelled', p_installment_numbers, 'reason', p_reason),
          p_actor);

  RETURN jsonb_build_object('cancelled', v_count, 'remaining', v_left, 'schedule', v_after);
END;
$$;

REVOKE ALL ON FUNCTION public.pt_plan_cancel_future_installments(uuid, integer[], text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_plan_cancel_future_installments(uuid, integer[], text, uuid) TO service_role;