ALTER TABLE public.pt_appointments
  ADD COLUMN IF NOT EXISTS historical_resolution text,
  ADD COLUMN IF NOT EXISTS historical_resolved_by uuid,
  ADD COLUMN IF NOT EXISTS historical_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS historical_resolution_note text;

CREATE OR REPLACE FUNCTION public.pt_unresolved_past_appointments()
RETURNS TABLE (id uuid, user_id uuid, instructor_id uuid, format text, starts_at timestamptz, status text,
  pass_id uuid, pack_name text, sessions_remaining int, sessions_total int, package_deducted boolean,
  consumed_usage_count int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.user_id, a.instructor_id, a.format::text, a.starts_at, a.status::text, a.pass_id, p.pack_name,
         p.sessions_remaining, p.sessions_total, a.package_deducted,
         (SELECT count(*)::int FROM pt_session_usage u WHERE u.appointment_id = a.id AND u.quantity < 0 AND u.reversed_at IS NULL)
  FROM pt_appointments a LEFT JOIN pt_passes p ON p.id = a.pass_id
  WHERE public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[])
    AND a.status = 'scheduled' AND a.starts_at < now()
    AND COALESCE(a.package_deducted,false) AND COALESCE(a.reservation_state,'none') = 'none'
  ORDER BY a.starts_at;
$$;

CREATE OR REPLACE FUNCTION public.pt_resolve_historical_appointment(p_appointment_id uuid, p_outcome text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_appt pt_appointments%ROWTYPE; v_reason text; v_before int; v_after int;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_appt FROM pt_appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  IF v_appt.status <> 'scheduled' OR v_appt.starts_at >= now()
     OR NOT COALESCE(v_appt.package_deducted,false) OR COALESCE(v_appt.reservation_state,'none') <> 'none' THEN
    RAISE EXCEPTION 'Only unresolved past appointments with an existing historical deduction can be resolved here';
  END IF;
  SELECT sessions_remaining INTO v_before FROM pt_passes WHERE id = v_appt.pass_id;
  v_reason := 'Historical reconciliation' || COALESCE(': ' || NULLIF(btrim(p_note),''), '');

  IF p_outcome = 'completed' THEN
    PERFORM public.pt_complete_session(p_appointment_id, '{}'::jsonb, false);
    UPDATE pt_appointments SET completed_at = v_appt.ends_at WHERE id = p_appointment_id;
  ELSIF p_outcome = 'no_show' THEN
    PERFORM public.cancel_pt_appointment(p_appointment_id, v_reason, 'no_show', NULL);
    UPDATE pt_appointments SET no_show_at = COALESCE(no_show_at, now()) WHERE id = p_appointment_id;
  ELSIF p_outcome IN ('late_client_cancel','timely_client_cancel','facility_cancel') THEN
    PERFORM public.cancel_pt_appointment(p_appointment_id, v_reason, p_outcome, v_reason);
  ELSIF p_outcome = 'staff_cancel' THEN
    PERFORM public.cancel_pt_appointment(p_appointment_id, v_reason, 'staff_cancel', NULL);
  ELSE
    RAISE EXCEPTION 'Unknown outcome: %', p_outcome;
  END IF;

  UPDATE pt_appointments SET historical_resolution = p_outcome, historical_resolved_by = auth.uid(),
    historical_resolved_at = now(), historical_resolution_note = NULLIF(btrim(p_note),'')
  WHERE id = p_appointment_id;
  SELECT sessions_remaining INTO v_after FROM pt_passes WHERE id = v_appt.pass_id;
  RETURN jsonb_build_object('success', true, 'outcome', p_outcome, 'sessions_before', v_before, 'sessions_after', v_after);
END $$;

REVOKE ALL ON FUNCTION public.pt_unresolved_past_appointments() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pt_resolve_historical_appointment(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_unresolved_past_appointments() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_resolve_historical_appointment(uuid, text, text) TO authenticated, service_role;