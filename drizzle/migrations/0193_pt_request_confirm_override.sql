DROP FUNCTION IF EXISTS public.pt_request_confirm(uuid, boolean, time without time zone);

CREATE FUNCTION public.pt_request_confirm(p_request_id uuid, p_use_alternate boolean DEFAULT false, p_confirm_time time without time zone DEFAULT NULL::time without time zone, p_force boolean DEFAULT false, p_override_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r training_requests; st pt_session_types; v_date date; v_time time; v_trainer uuid; v_start timestamptz; v_end timestamptz;
  v_appt pt_appointments; v_has_pass boolean; v_chk jsonb; v_outcome text; v_force boolean := false;
BEGIN
  SELECT * INTO r FROM training_requests WHERE id = p_request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT pt_request_can_act(r) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF r.request_status = 'confirmed' OR r.appointment_id IS NOT NULL THEN
    RETURN jsonb_build_object('appointment_id', r.appointment_id, 'already_confirmed', true);
  END IF;
  IF r.request_kind <> 'appointment_request' THEN
    RAISE EXCEPTION 'This is a website inquiry. Convert it to an appointment request before confirming';
  END IF;
  IF r.request_status IN ('declined','cancelled','waitlisted') THEN RAISE EXCEPTION 'This request is already %', r.request_status; END IF;
  IF r.client_user_id IS NULL THEN RAISE EXCEPTION 'Link this request to a client account before confirming'; END IF;
  SELECT * INTO st FROM pt_session_types WHERE id = r.pt_session_type_id;
  IF st.id IS NULL THEN RAISE EXCEPTION 'Choose a session type before confirming'; END IF;
  IF p_use_alternate THEN
    IF r.request_status <> 'alternate_offered' THEN RAISE EXCEPTION 'No alternate has been offered'; END IF;
    v_date := r.alt_date; v_time := r.alt_time; v_trainer := coalesce(r.alt_trainer_id, r.requested_trainer_id);
    v_outcome := 'alternate_accepted';
  ELSE
    v_date := r.preferred_date; v_trainer := r.requested_trainer_id;
    IF p_confirm_time IS NOT NULL AND p_confirm_time IS DISTINCT FROM r.preferred_time THEN
      IF r.flexibility = 'exact' OR (r.flexibility = 'window' AND (r.earliest_time IS NULL OR r.latest_time IS NULL)) THEN
        RAISE EXCEPTION 'OUTSIDE_WINDOW: The client asked for this exact time. Offer an alternate instead.';
      END IF;
      IF r.flexibility = 'window' AND (p_confirm_time < r.earliest_time
          OR p_confirm_time + make_interval(mins => st.duration_minutes) > r.latest_time) THEN
        RAISE EXCEPTION 'OUTSIDE_WINDOW: That time is outside the client''s availability window. Offer an alternate instead.';
      END IF;
      v_time := p_confirm_time; v_outcome := 'within_window';
    ELSE
      v_time := r.preferred_time; v_outcome := 'requested_time';
    END IF;
  END IF;
  IF v_date IS NULL OR v_time IS NULL THEN RAISE EXCEPTION 'Set a date and time before confirming'; END IF;
  IF v_trainer IS NULL THEN RAISE EXCEPTION 'Assign a trainer before confirming'; END IF;
  v_start := (v_date + v_time) AT TIME ZONE 'America/Detroit';
  v_end := v_start + make_interval(mins => st.duration_minutes);

  v_chk := public.pt_check_slot(v_start, v_end, v_trainer, st.default_location_id, NULL, st.format, r.client_user_id, st.id);
  IF (v_chk->>'has_conflict')::boolean THEN
    -- Real clashes can never be overridden; hours/time-off can, by an admin or manager with a reason.
    IF public.pt_slot_hard_conflict(v_chk) OR NOT coalesce(p_force, false) THEN
      RAISE EXCEPTION 'UNAVAILABLE: %', v_chk::text;
    END IF;
    IF NOT has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role]) THEN
      RAISE EXCEPTION 'OVERRIDE_NOT_ALLOWED: Only an admin or manager can book outside availability.';
    END IF;
    IF NULLIF(btrim(coalesce(p_override_reason,'')), '') IS NULL THEN
      RAISE EXCEPTION 'OVERRIDE_REASON_REQUIRED: Add a reason to book outside availability.';
    END IF;
    v_force := true;
  END IF;

  v_has_pass := EXISTS (SELECT 1 FROM pt_passes WHERE user_id = r.client_user_id AND format = st.format AND status='active'
    AND sessions_remaining - pt_pass_reserved_count(id) > 0 AND expires_at >= (now() AT TIME ZONE 'America/Detroit')::date);
  v_appt := public.book_pt_appointment(r.client_user_id, st.format, v_start, st.duration_minutes, v_trainer,
    coalesce(r.client_note, r.goals), NULL, NOT v_has_pass,
    CASE WHEN v_has_pass THEN 0 ELSE public.pt_single_session_price_cents(r.client_user_id, st.id, v_trainer) END,
    st.default_location_id, v_force, CASE WHEN v_force THEN btrim(p_override_reason) END);
  UPDATE pt_appointments SET session_type_id = st.id WHERE id = v_appt.id;
  UPDATE training_requests SET request_status='confirmed', appointment_id=v_appt.id,
    confirmed_starts_at = v_start, confirmed_trainer_id = v_trainer, confirmation_outcome = v_outcome,
    resolved_at=now(), resolved_by=auth.uid(), updated_at=now() WHERE id = r.id;
  RETURN jsonb_build_object('appointment_id', v_appt.id, 'already_confirmed', false, 'package_reserved', v_has_pass, 'outcome', v_outcome, 'override', v_force);
END $function$;

REVOKE ALL ON FUNCTION public.pt_request_confirm(uuid, boolean, time without time zone, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_request_confirm(uuid, boolean, time without time zone, boolean, text) TO authenticated, service_role;