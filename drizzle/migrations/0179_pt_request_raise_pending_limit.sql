CREATE OR REPLACE FUNCTION public.pt_request_create(p_session_type_id uuid, p_trainer_id uuid, p_preferred_date date DEFAULT NULL::date, p_preferred_time time without time zone DEFAULT NULL::time without time zone, p_flexibility_note text DEFAULT NULL::text, p_client_note text DEFAULT NULL::text, p_earliest_time time without time zone DEFAULT NULL::time without time zone, p_latest_time time without time zone DEFAULT NULL::time without time zone, p_flexibility text DEFAULT NULL::text, p_slot_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_p record; v_st record; v_id uuid; v_member boolean; v_flex text;
  v_date date := p_preferred_date; v_time time := p_preferred_time; v_e time := p_earliest_time; v_l time := p_latest_time;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to request a session'; END IF;
  PERFORM public.pt_assert_client_request_allowed(p_trainer_id);
  SELECT * INTO v_st FROM pt_session_types WHERE id = p_session_type_id AND is_active AND client_requestable;
  IF v_st.id IS NULL THEN RAISE EXCEPTION 'Choose a session type'; END IF;
  IF p_trainer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pt_trainer_services WHERE instructor_id = p_trainer_id AND session_type_id = v_st.id) THEN
    RAISE EXCEPTION 'That trainer does not offer this session';
  END IF;
  IF (SELECT count(*) FROM training_requests q WHERE q.client_user_id = v_uid AND q.request_kind = 'appointment_request'
        AND q.request_status IN ('requested','under_review','alternate_offered')) >= 30 THEN
    RAISE EXCEPTION 'You already have 30 requests waiting. Please wait for the club to reply before sending more.';
  END IF;
  IF p_slot_starts_at IS NOT NULL THEN
    IF p_trainer_id IS NULL THEN RAISE EXCEPTION 'Choose a trainer'; END IF;
    IF NOT public.pt_client_slot_is_open(p_slot_starts_at, v_st.id, p_trainer_id, v_uid) THEN
      RAISE EXCEPTION 'SLOT_TAKEN: That time is no longer available. Please choose another time.';
    END IF;
    v_date := (p_slot_starts_at AT TIME ZONE 'America/Detroit')::date;
    v_time := (p_slot_starts_at AT TIME ZONE 'America/Detroit')::time;
    -- The picked open time is the preferred time; the client may also give a window they can do instead.
    v_flex := CASE WHEN p_flexibility = 'window' THEN 'window' ELSE 'exact' END;
  ELSE
    IF v_date IS NULL OR v_date <= (now() AT TIME ZONE 'America/Detroit')::date THEN RAISE EXCEPTION 'Choose a date from tomorrow onward'; END IF;
    IF v_time IS NULL THEN RAISE EXCEPTION 'Choose a preferred time'; END IF;
    v_flex := CASE WHEN p_flexibility IN ('window','exact') THEN p_flexibility ELSE 'exact' END;
  END IF;
  IF v_flex = 'window' THEN
    IF v_e IS NULL OR v_l IS NULL OR v_l <= v_e THEN RAISE EXCEPTION 'Choose an availability window that ends after it starts'; END IF;
    IF v_time < v_e OR v_time >= v_l THEN RAISE EXCEPTION 'Your preferred time must fall inside your availability window'; END IF;
  ELSE
    v_e := NULL; v_l := NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM training_requests q WHERE q.client_user_id = v_uid AND q.request_kind = 'appointment_request'
               AND q.request_status IN ('requested','under_review','alternate_offered')
               AND q.preferred_date = v_date AND q.preferred_time = v_time
               AND q.requested_trainer_id IS NOT DISTINCT FROM p_trainer_id) THEN
    RAISE EXCEPTION 'You already requested this time.';
  END IF;
  SELECT first_name, last_name, email, phone INTO v_p FROM profiles WHERE user_id = v_uid;
  v_member := EXISTS (SELECT 1 FROM members m WHERE m.user_id = v_uid AND m.status <> 'cancelled');
  INSERT INTO training_requests(service, full_name, email, phone, is_member, status, submitted_by_user_id, client_user_id,
    requested_trainer_id, pt_session_type_id, preferred_date, preferred_time, flexibility_note, client_note, request_status,
    earliest_time, latest_time, flexibility, requested_slot_at, request_kind, origin)
  VALUES (v_st.name, trim(coalesce(v_p.first_name,'')||' '||coalesce(v_p.last_name,'')), coalesce(v_p.email, public.current_user_email()), coalesce(v_p.phone,''),
    v_member, 'new', v_uid, v_uid, p_trainer_id, v_st.id, v_date, v_time,
    left(p_flexibility_note, 500), left(p_client_note, 300), 'requested', v_e, v_l, v_flex, p_slot_starts_at,
    'appointment_request', 'authenticated_client')
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;