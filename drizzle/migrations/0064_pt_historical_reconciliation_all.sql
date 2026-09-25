CREATE OR REPLACE FUNCTION public.pt_historical_unresolved_list()
RETURNS TABLE(id uuid, user_id uuid, instructor_id uuid, format text, session_type_name text, starts_at timestamptz, status text,
  pass_id uuid, pack_name text, sessions_remaining int, sessions_total int, package_deducted boolean, reservation_state text,
  consumed_usage_count int, payment_status text, amount_due_cents int, invoice_count int, allocation_count int,
  eligible_pass_id uuid, eligible_pack_name text, eligible_sessions_remaining int, needs_review boolean, review_reasons text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE a pt_appointments%ROWTYPE; v_pick uuid; v_reasons text[];
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN RETURN; END IF;
  FOR a IN SELECT * FROM pt_appointments x WHERE x.status='scheduled' AND x.starts_at < now() ORDER BY x.starts_at LOOP
    v_pick := NULL; v_reasons := ARRAY[]::text[];
    IF NOT COALESCE(a.package_deducted,false) AND COALESCE(a.reservation_state,'none')='none' THEN
      BEGIN v_pick := public.pt_pick_pass_for_appointment(a); EXCEPTION WHEN OTHERS THEN v_pick := NULL; END;
    END IF;
    IF a.instructor_id IS NULL THEN v_reasons := v_reasons || 'No trainer recorded'; END IF;
    IF v_pick IS NOT NULL THEN v_reasons := v_reasons || 'Client has a current package that a completed/no-show/late outcome could draw from'; END IF;
    IF COALESCE(a.package_deducted,false) AND NOT EXISTS (SELECT 1 FROM pt_session_usage u WHERE u.appointment_id=a.id AND u.quantity<0 AND u.reversed_at IS NULL) THEN
      v_reasons := v_reasons || 'Marked deducted with no session history entry'; END IF;
    id := a.id; user_id := a.user_id; instructor_id := a.instructor_id; format := a.format::text; starts_at := a.starts_at; status := a.status::text;
    pass_id := a.pass_id; package_deducted := COALESCE(a.package_deducted,false); reservation_state := COALESCE(a.reservation_state,'none');
    payment_status := a.payment_status; amount_due_cents := a.amount_due_cents;
    SELECT st.name INTO session_type_name FROM pt_session_types st WHERE st.id = a.session_type_id;
    SELECT p.pack_name, p.sessions_remaining, p.sessions_total INTO pack_name, sessions_remaining, sessions_total FROM pt_passes p WHERE p.id=a.pass_id;
    IF a.pass_id IS NULL THEN pack_name := NULL; sessions_remaining := NULL; sessions_total := NULL; END IF;
    SELECT count(*)::int INTO consumed_usage_count FROM pt_session_usage u WHERE u.appointment_id=a.id AND u.quantity<0 AND u.reversed_at IS NULL;
    SELECT count(*)::int INTO invoice_count FROM pt_invoice_line_items li WHERE li.appointment_id=a.id;
    SELECT count(*)::int INTO allocation_count FROM pt_payment_allocations pa WHERE pa.appointment_id=a.id;
    eligible_pass_id := v_pick; eligible_pack_name := NULL; eligible_sessions_remaining := NULL;
    IF v_pick IS NOT NULL THEN SELECT p.pack_name, p.sessions_remaining INTO eligible_pack_name, eligible_sessions_remaining FROM pt_passes p WHERE p.id=v_pick; END IF;
    needs_review := array_length(v_reasons,1) IS NOT NULL; review_reasons := v_reasons;
    RETURN NEXT;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.pt_resolve_historical_appointment_v2(p_appointment_id uuid, p_outcome text, p_note text DEFAULT NULL, p_use_package boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_appt pt_appointments%ROWTYPE; v_reason text; v_pick uuid; v_after pt_appointments%ROWTYPE;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_appt FROM pt_appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  IF v_appt.status <> 'scheduled' OR v_appt.starts_at >= now() THEN RAISE EXCEPTION 'Only unresolved past appointments can be resolved here'; END IF;
  IF p_outcome NOT IN ('completed','no_show','late_client_cancel','timely_client_cancel','staff_cancel','facility_cancel') THEN
    RAISE EXCEPTION 'Unknown outcome: %', p_outcome; END IF;

  -- Already-deducted historical rows keep the original, verified path.
  IF COALESCE(v_appt.package_deducted,false) AND COALESCE(v_appt.reservation_state,'none')='none' THEN
    RETURN public.pt_resolve_historical_appointment(p_appointment_id, p_outcome, p_note);
  END IF;

  v_reason := 'Historical reconciliation' || COALESCE(': ' || NULLIF(btrim(p_note),''), '');
  IF COALESCE(v_appt.reservation_state,'none')='none' AND p_outcome IN ('completed','no_show','late_client_cancel') THEN
    v_pick := public.pt_pick_pass_for_appointment(v_appt);
    IF v_pick IS NOT NULL AND NOT p_use_package THEN
      RAISE EXCEPTION 'PACKAGE_CONFIRM_REQUIRED: this client has a current package session that would be used. Confirm package use to continue.';
    END IF;
  END IF;

  IF p_outcome = 'completed' THEN
    PERFORM public.pt_complete_session(p_appointment_id, '{}'::jsonb, v_appt.reservation_state='reserved' OR v_pick IS NOT NULL);
    UPDATE pt_appointments SET completed_at = v_appt.ends_at WHERE id = p_appointment_id;
  ELSIF p_outcome = 'no_show' THEN
    PERFORM public.cancel_pt_appointment(p_appointment_id, v_reason, 'no_show', NULL);
  ELSIF p_outcome = 'staff_cancel' THEN
    PERFORM public.cancel_pt_appointment(p_appointment_id, v_reason, 'staff_cancel', NULL);
  ELSE
    PERFORM public.cancel_pt_appointment(p_appointment_id, v_reason, p_outcome, v_reason);
  END IF;

  UPDATE pt_appointments SET historical_resolution = p_outcome, historical_resolved_by = auth.uid(),
    historical_resolved_at = now(), historical_resolution_note = NULLIF(btrim(p_note),'')
  WHERE id = p_appointment_id RETURNING * INTO v_after;
  RETURN jsonb_build_object('success', true, 'outcome', p_outcome, 'status', v_after.status, 'payment_status', v_after.payment_status,
    'amount_due_cents', v_after.amount_due_cents, 'package_used', COALESCE(v_after.package_deducted,false));
END $$;

CREATE OR REPLACE FUNCTION public.pt_resolve_historical_appointments_batch(p_ids uuid[], p_outcome text, p_note text DEFAULT NULL, p_use_package boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id uuid; v_n int := 0;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_ids IS NULL OR array_length(p_ids,1) IS NULL THEN RAISE EXCEPTION 'No appointments selected'; END IF;
  FOREACH v_id IN ARRAY p_ids LOOP
    PERFORM public.pt_resolve_historical_appointment_v2(v_id, p_outcome, p_note, p_use_package);
    v_n := v_n + 1;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'resolved', v_n);
END $$;

REVOKE ALL ON FUNCTION public.pt_historical_unresolved_list() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pt_resolve_historical_appointment_v2(uuid,text,text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pt_resolve_historical_appointments_batch(uuid[],text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_historical_unresolved_list() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_resolve_historical_appointment_v2(uuid,text,text,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_resolve_historical_appointments_batch(uuid[],text,text,boolean) TO authenticated, service_role;