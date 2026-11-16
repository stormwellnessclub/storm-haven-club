CREATE OR REPLACE FUNCTION public.pt_single_session_price_cents(p_user uuid, p_session_type_id uuid, p_trainer_id uuid)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE st pt_session_types; v_member boolean; v_email text; v_storm boolean; v_price int;
BEGIN
  SELECT * INTO st FROM pt_session_types WHERE id = p_session_type_id;
  IF st.id IS NULL THEN RETURN 0; END IF;
  IF coalesce(st.default_price_cents, 0) > 0 THEN RETURN st.default_price_cents; END IF;
  SELECT lower(email) INTO v_email FROM profiles WHERE id = p_user;
  v_member := EXISTS (SELECT 1 FROM members m WHERE (m.user_id = p_user OR (v_email IS NOT NULL AND lower(m.email) = v_email))
                        AND m.status IN ('active','past_due','frozen'));
  IF st.format = 'semi_private' THEN
    SELECT price_cents INTO v_price FROM pt_packs WHERE is_active AND sessions = 1 AND format = 'semi_private'
      AND (CASE WHEN v_member THEN name NOT ILIKE 'non-member%' ELSE name ILIKE 'non-member%' END)
      ORDER BY display_order, price_cents LIMIT 1;
  ELSIF st.format = 'one_on_one' THEN
    v_storm := EXISTS (SELECT 1 FROM instructors i WHERE i.id = p_trainer_id AND (to_jsonb(i)->>'first_name') ILIKE 'storm');
    IF v_storm THEN
      SELECT price_cents INTO v_price FROM pt_packs WHERE is_active AND sessions = 1 AND format = 'one_on_one' AND name ILIKE '%with storm%' LIMIT 1;
    END IF;
    IF v_price IS NULL THEN
      SELECT price_cents INTO v_price FROM pt_packs WHERE is_active AND sessions = 1 AND format = 'one_on_one'
        AND name NOT ILIKE '%with %' AND name NOT ILIKE 'non-member%' ORDER BY display_order, price_cents LIMIT 1;
    END IF;
  ELSE
    SELECT price_cents INTO v_price FROM pt_packs WHERE is_active AND sessions = 1 AND format = st.format
      AND name NOT ILIKE 'non-member%' ORDER BY display_order, price_cents LIMIT 1;
  END IF;
  RETURN coalesce(v_price, 0);
END $$;
REVOKE ALL ON FUNCTION public.pt_single_session_price_cents(uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pt_single_session_price_cents(uuid, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.pt_request_confirm(p_request_id uuid, p_use_alternate boolean DEFAULT false, p_confirm_time time without time zone DEFAULT NULL::time without time zone)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r training_requests; st pt_session_types; v_date date; v_time time; v_trainer uuid; v_start timestamptz; v_end timestamptz;
  v_appt pt_appointments; v_has_pass boolean; v_chk jsonb; v_outcome text;
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
    RAISE EXCEPTION 'UNAVAILABLE: %', v_chk::text;
  END IF;

  v_has_pass := EXISTS (SELECT 1 FROM pt_passes WHERE user_id = r.client_user_id AND format = st.format AND status='active'
    AND sessions_remaining - pt_pass_reserved_count(id) > 0 AND expires_at >= (now() AT TIME ZONE 'America/Detroit')::date);
  v_appt := public.book_pt_appointment(r.client_user_id, st.format, v_start, st.duration_minutes, v_trainer,
    coalesce(r.client_note, r.goals), NULL, NOT v_has_pass,
    CASE WHEN v_has_pass THEN 0 ELSE public.pt_single_session_price_cents(r.client_user_id, st.id, v_trainer) END,
    st.default_location_id, false, NULL);
  UPDATE pt_appointments SET session_type_id = st.id WHERE id = v_appt.id;
  UPDATE training_requests SET request_status='confirmed', appointment_id=v_appt.id,
    confirmed_starts_at = v_start, confirmed_trainer_id = v_trainer, confirmation_outcome = v_outcome,
    resolved_at=now(), resolved_by=auth.uid(), updated_at=now() WHERE id = r.id;
  RETURN jsonb_build_object('appointment_id', v_appt.id, 'already_confirmed', false, 'package_reserved', v_has_pass, 'outcome', v_outcome);
END $function$;