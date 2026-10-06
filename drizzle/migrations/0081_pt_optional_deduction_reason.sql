CREATE OR REPLACE FUNCTION public.pt_override_appointment_consequence(p_appointment_id uuid, p_action text, p_reason text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_res jsonb; v_reason text := NULLIF(btrim(COALESCE(p_reason,'')), '');
BEGIN
  IF NOT public.pt_is_financial_manager(auth.uid()) THEN RAISE EXCEPTION 'Only a manager or admin can override a session outcome'; END IF;
  v_reason := COALESCE(v_reason, CASE p_action WHEN 'consume_credit' THEN 'Credit deducted by staff'
    WHEN 'restore_credit' THEN 'Credit returned by staff' ELSE 'Charge waived by staff' END);
  IF p_action = 'restore_credit' THEN
    v_res := public.pt_set_package_deduction(p_appointment_id, false);
  ELSIF p_action = 'consume_credit' THEN
    v_res := public.pt_set_package_deduction(p_appointment_id, true);
  ELSIF p_action = 'waive_charge' THEN
    v_res := public.pt_waive_sessions(ARRAY[p_appointment_id], v_reason);
  ELSE
    RAISE EXCEPTION 'Unknown override: %', p_action;
  END IF;
  UPDATE public.pt_appointments SET cancel_override_by = auth.uid(), cancel_override_reason = p_action || ': ' || v_reason,
    cancel_overridden_at = now(), updated_at = now() WHERE id = p_appointment_id;
  RETURN v_res || jsonb_build_object('action', p_action);
END $function$;

CREATE OR REPLACE FUNCTION public.pt_manual_consume_session(p_pass_id uuid, p_quantity integer DEFAULT 1, p_reason text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_pass public.pt_passes%ROWTYPE;
  v_res jsonb;
  v_reason text := COALESCE(NULLIF(btrim(COALESCE(p_reason,'')), ''), 'Session used (staff deduction)');
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF COALESCE(p_quantity, 0) <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  SELECT * INTO v_pass FROM public.pt_passes WHERE id = p_pass_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Package not found'; END IF;
  IF v_pass.status <> 'active' THEN RAISE EXCEPTION 'Package is not active'; END IF;
  IF v_pass.expires_at < (now() AT TIME ZONE 'America/Detroit')::date THEN RAISE EXCEPTION 'Package expired'; END IF;
  v_res := public.pt_apply_session_delta(p_pass_id => p_pass_id, p_delta => -p_quantity,
    p_event_type => 'manual_consume', p_reason => v_reason, p_actor => auth.uid());
  INSERT INTO public.pt_pass_adjustments
    (pass_id, user_id, delta_sessions, sessions_before, sessions_after, adjustment_type, reason,
     expires_at_before, expires_at_after, created_by)
  VALUES (p_pass_id, v_pass.user_id, -p_quantity, (v_res->>'sessions_before')::int, (v_res->>'sessions_after')::int,
     'manual_consume', v_reason, v_pass.expires_at, v_pass.expires_at, auth.uid());
  RETURN jsonb_build_object('success', true, 'sessions_remaining', (v_res->>'sessions_after')::int);
END;
$function$;