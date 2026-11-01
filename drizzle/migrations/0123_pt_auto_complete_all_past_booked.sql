CREATE OR REPLACE FUNCTION public.pt_auto_consume_past_reservations()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.pt_appointments%ROWTYPE; n integer := 0; v_pass uuid; v_res jsonb;
BEGIN
  FOR r IN SELECT * FROM pt_appointments
    WHERE status = 'scheduled' AND COALESCE(is_waitlist,false) = false
      AND COALESCE(ends_at, starts_at) < now()
  LOOP
    BEGIN
      IF r.reservation_state = 'reserved' AND r.pass_id IS NOT NULL THEN
        -- the held session becomes the used session (one deduction only)
        PERFORM pt_reservation_consume(r.id, 'Session auto-used after scheduled time', 'appt_complete:' || r.id::text, NULL);
      ELSIF NOT COALESCE(r.package_deducted,false) AND COALESCE(r.payment_status,'unpaid') IN ('unpaid','past_due') THEN
        v_pass := public.pt_pick_pass_for_appointment(r);
        IF v_pass IS NOT NULL THEN
          v_res := public.pt_apply_session_delta(v_pass, -1, 'session_used', 'Session auto-used after scheduled time', r.id,
            'appt_complete:' || r.id::text, NULL, NULL, COALESCE(r.starts_at, now()));
          UPDATE pt_appointments SET package_deducted = true, package_deducted_at = now(), pass_id = COALESCE(pass_id, v_pass),
            usage_id = NULLIF(v_res->>'usage_id','')::uuid, updated_at = now() WHERE id = r.id;
        END IF;
      END IF;
      UPDATE pt_appointments SET status = 'completed', completed_at = COALESCE(completed_at, COALESCE(ends_at, starts_at)), updated_at = now()
       WHERE id = r.id;
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'auto-complete failed for %: %', r.id, SQLERRM;
    END;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.pt_auto_consume_past_reservations() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pt_override_appointment_consequence(p_appointment_id uuid, p_action text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_res jsonb; v_reason text := NULLIF(btrim(COALESCE(p_reason,'')), '');
BEGIN
  IF NOT public.pt_is_financial_manager(auth.uid()) THEN RAISE EXCEPTION 'Only a manager or admin can override a session outcome'; END IF;
  IF p_action = 'restore_credit' AND NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Only an admin can restore a session to a package';
  END IF;
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