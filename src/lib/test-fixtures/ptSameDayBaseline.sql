-- Pre-change PT functions for isolated migration regression tests; no client data.
CREATE OR REPLACE FUNCTION public.pt_client_slot_is_open(p_start timestamp with time zone, p_session_type_id uuid, p_trainer_id uuid, p_uid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE st pt_session_types; v_end timestamptz; r jsonb; v_date date; v_tomorrow timestamptz;
BEGIN
  SELECT * INTO st FROM pt_session_types WHERE id = p_session_type_id AND is_active AND client_requestable;
  IF st.id IS NULL OR p_trainer_id IS NULL OR p_start IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM pt_trainer_services WHERE instructor_id = p_trainer_id AND session_type_id = st.id) THEN RETURN false; END IF;
  v_tomorrow := (((now() AT TIME ZONE 'America/Detroit')::date + 1)::timestamp) AT TIME ZONE 'America/Detroit';
  IF p_start < v_tomorrow THEN RETURN false; END IF;
  v_end := p_start + make_interval(mins => st.duration_minutes);
  v_date := (p_start AT TIME ZONE 'America/Detroit')::date;
  IF NOT EXISTS (SELECT 1 FROM pt_trainer_day_windows(p_trainer_id, v_date) w WHERE w.win_start <= p_start AND w.win_end >= v_end) THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM class_sessions cs WHERE cs.instructor_id = p_trainer_id AND NOT coalesce(cs.is_cancelled, false)
               AND cs.session_date BETWEEN v_date - 1 AND v_date + 1
               AND ((cs.session_date + cs.start_time) AT TIME ZONE 'America/Detroit') < v_end
               AND ((cs.session_date + cs.end_time) AT TIME ZONE 'America/Detroit') > p_start) THEN RETURN false; END IF;
  IF p_uid IS NOT NULL AND EXISTS (SELECT 1 FROM training_requests q WHERE q.client_user_id = p_uid
       AND q.request_kind = 'appointment_request' AND q.request_status IN ('requested','under_review','alternate_offered')
       AND q.preferred_date = v_date AND ((q.preferred_date + q.preferred_time) AT TIME ZONE 'America/Detroit') = p_start) THEN RETURN false; END IF;
  r := public.pt_check_slot_core(p_start, v_end, p_trainer_id, st.default_location_id, NULL, st.format, p_uid, st.id);
  IF coalesce((r->>'has_conflict')::boolean, true) OR coalesce(r->>'availability','') <> 'available' THEN RETURN false; END IF;
  IF coalesce((r->>'confirmed')::int,0) + coalesce((r->>'pending_requests')::int,0) >= coalesce((r->>'capacity')::int,1) THEN RETURN false; END IF;
  RETURN true;
END $function$;

CREATE OR REPLACE FUNCTION public.pt_waitlist_join(p_session_type_id uuid, p_trainer_id uuid, p_starts_at timestamp with time zone, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_date date; v_time time;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Please sign in'; END IF;
  PERFORM public.pt_assert_client_request_allowed(p_trainer_id);
  IF NOT public.pt_client_slot_is_full(p_starts_at, p_session_type_id, p_trainer_id, v_uid) THEN
    RAISE EXCEPTION 'That time is not full — you can request it directly';
  END IF;
  v_date := (p_starts_at AT TIME ZONE 'America/Detroit')::date; v_time := (p_starts_at AT TIME ZONE 'America/Detroit')::time;
  IF EXISTS (SELECT 1 FROM pt_waitlist WHERE client_user_id = v_uid AND status = 'waiting' AND preferred_trainer_id = p_trainer_id
             AND session_type_id = p_session_type_id AND preferred_date = v_date AND preferred_time = v_time) THEN
    RAISE EXCEPTION 'You are already on the waitlist for this time';
  END IF;
  IF (SELECT count(*) FROM pt_waitlist WHERE client_user_id = v_uid AND status = 'waiting') >= 30 THEN
    RAISE EXCEPTION 'Too many waitlist entries';
  END IF;
  INSERT INTO pt_waitlist (client_user_id, preferred_trainer_id, session_type_id, preferred_date, preferred_time, flexibility, notes, created_by)
  VALUES (v_uid, p_trainer_id, p_session_type_id, v_date, v_time, 'exact', nullif(left(trim(coalesce(p_notes,'')), 500), ''), v_uid)
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

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

CREATE OR REPLACE FUNCTION public.pt_request_client_change(p_request_id uuid, p_trainer_id uuid, p_slot_starts_at timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); r training_requests; v_date date; v_time time;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to manage your requests'; END IF;
  SELECT * INTO r FROM training_requests WHERE id = p_request_id FOR UPDATE;
  IF r.id IS NULL OR r.request_kind <> 'appointment_request'
     OR NOT (r.client_user_id = v_uid OR r.submitted_by_user_id = v_uid) THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF r.request_status NOT IN ('requested','under_review','alternate_offered') THEN
    RAISE EXCEPTION 'This request can no longer be changed.';
  END IF;
  IF p_trainer_id IS NULL OR p_slot_starts_at IS NULL THEN RAISE EXCEPTION 'Choose a new time'; END IF;
  PERFORM public.pt_assert_client_request_allowed(p_trainer_id);
  IF NOT public.pt_client_slot_is_open(p_slot_starts_at, r.pt_session_type_id, p_trainer_id, v_uid) THEN
    RAISE EXCEPTION 'SLOT_TAKEN: That time is no longer available. Please choose another time.';
  END IF;
  v_date := (p_slot_starts_at AT TIME ZONE 'America/Detroit')::date;
  v_time := (p_slot_starts_at AT TIME ZONE 'America/Detroit')::time;
  UPDATE training_requests SET requested_trainer_id = p_trainer_id, preferred_date = v_date, preferred_time = v_time,
    requested_slot_at = p_slot_starts_at, flexibility = 'exact', earliest_time = NULL, latest_time = NULL,
    request_status = 'requested', alt_date = NULL, alt_time = NULL, alt_trainer_id = NULL, alt_note = NULL,
    offered_at = NULL, offered_by = NULL, updated_at = now()
   WHERE id = r.id;
END $function$;

CREATE OR REPLACE FUNCTION public.pt_client_request_times(p_session_type_id uuid, p_trainer_id uuid, p_from date DEFAULT NULL::date, p_days integer DEFAULT 14)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); st pt_session_types; d date; w record; t timestamptz; v_out jsonb := '[]'::jsonb;
  v_today date := (now() AT TIME ZONE 'America/Detroit')::date; v_from date; v_to date;
BEGIN
  IF p_trainer_id IS NULL THEN RAISE EXCEPTION 'Choose a trainer'; END IF;
  PERFORM public.pt_assert_client_request_allowed(p_trainer_id);
  SELECT * INTO st FROM pt_session_types WHERE id = p_session_type_id AND is_active AND client_requestable;
  IF st.id IS NULL THEN RAISE EXCEPTION 'Unknown session type'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pt_trainer_services WHERE instructor_id = p_trainer_id AND session_type_id = st.id) THEN
    RAISE EXCEPTION 'That trainer does not offer this session';
  END IF;
  v_from := greatest(coalesce(p_from, v_today + 1), v_today + 1);
  v_to := v_from + least(greatest(coalesce(p_days, 14), 1), 28) - 1;
  FOR d IN SELECT generate_series(v_from, v_to, interval '1 day')::date LOOP
    FOR w IN SELECT * FROM public.pt_trainer_day_windows(p_trainer_id, d) ORDER BY 1 LOOP
      t := w.win_start;
      WHILE t + make_interval(mins => st.duration_minutes) <= w.win_end LOOP
        IF public.pt_client_slot_is_open(t, st.id, p_trainer_id, v_uid)
           AND NOT v_out @> jsonb_build_array(jsonb_build_object('starts_at', t)) THEN
          v_out := v_out || jsonb_build_array(jsonb_build_object('starts_at', t));
        END IF;
        -- One-hour blocks counted from the start of the trainer's hours (4:30, 5:30, ...).
        t := t + interval '60 minutes';
      END LOOP;
    END LOOP;
  END LOOP;
  RETURN v_out;
END $function$;

CREATE OR REPLACE FUNCTION public.pt_client_request_times_all(p_session_type_id uuid, p_from date DEFAULT NULL::date, p_days integer DEFAULT 14)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); st pt_session_types; tr record; d date; w record; t timestamptz; v_out jsonb := '[]'::jsonb;
  v_today date := (now() AT TIME ZONE 'America/Detroit')::date; v_from date; v_to date; v_status text;
BEGIN
  PERFORM public.pt_assert_client_request_allowed(NULL);
  SELECT * INTO st FROM pt_session_types WHERE id = p_session_type_id AND is_active AND client_requestable;
  IF st.id IS NULL THEN RAISE EXCEPTION 'Unknown session type'; END IF;
  v_from := greatest(coalesce(p_from, v_today + 1), v_today + 1);
  v_to := v_from + least(greatest(coalesce(p_days, 14), 1), 28) - 1;
  FOR tr IN
    SELECT i.id, trim(coalesce(i.first_name,'')||' '||coalesce(i.last_name,'')) AS name
      FROM pt_trainer_services ts JOIN instructors i ON i.id = ts.instructor_id
     WHERE ts.session_type_id = st.id AND i.is_active
       AND public.pt_effective_client_booking_mode(i.id) = 'request'
  LOOP
    FOR d IN SELECT generate_series(v_from, v_to, interval '1 day')::date LOOP
      FOR w IN SELECT * FROM public.pt_trainer_day_windows(tr.id, d) ORDER BY 1 LOOP
        t := w.win_start;
        WHILE t + make_interval(mins => st.duration_minutes) <= w.win_end LOOP
          v_status := NULL;
          IF public.pt_client_slot_is_open(t, st.id, tr.id, v_uid) THEN v_status := 'open';
          ELSIF public.pt_client_slot_is_full(t, st.id, tr.id, v_uid) THEN
            v_status := CASE WHEN EXISTS (SELECT 1 FROM pt_waitlist x WHERE x.client_user_id = v_uid AND x.status = 'waiting'
                AND x.preferred_trainer_id = tr.id AND x.session_type_id = st.id AND x.preferred_date = d
                AND x.preferred_time = (t AT TIME ZONE 'America/Detroit')::time) THEN 'waitlisted' ELSE 'full' END;
          END IF;
          IF v_status IS NOT NULL AND NOT v_out @> jsonb_build_array(jsonb_build_object('starts_at', t, 'trainer_id', tr.id)) THEN
            v_out := v_out || jsonb_build_array(jsonb_build_object('starts_at', t, 'trainer_id', tr.id, 'trainer_name', tr.name,
                       'ends_at', t + make_interval(mins => st.duration_minutes), 'status', v_status));
          END IF;
          t := t + interval '60 minutes';
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
  RETURN v_out;
END $function$;

CREATE OR REPLACE FUNCTION public.pt_client_slot_is_full(p_start timestamp with time zone, p_session_type_id uuid, p_trainer_id uuid, p_uid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE st pt_session_types; v_end timestamptz; v_date date;
BEGIN
  SELECT * INTO st FROM pt_session_types WHERE id = p_session_type_id AND is_active AND client_requestable;
  IF st.id IS NULL OR p_start IS NULL THEN RETURN false; END IF;
  IF p_start < (((now() AT TIME ZONE 'America/Detroit')::date + 1)::timestamp AT TIME ZONE 'America/Detroit') THEN RETURN false; END IF;
  v_end := p_start + make_interval(mins => st.duration_minutes);
  v_date := (p_start AT TIME ZONE 'America/Detroit')::date;
  IF NOT EXISTS (SELECT 1 FROM pt_trainer_day_windows(p_trainer_id, v_date) w WHERE w.win_start <= p_start AND w.win_end >= v_end) THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM class_sessions cs WHERE cs.instructor_id = p_trainer_id AND NOT coalesce(cs.is_cancelled,false)
       AND cs.session_date BETWEEN v_date - 1 AND v_date + 1
       AND ((cs.session_date + cs.start_time) AT TIME ZONE 'America/Detroit') < v_end
       AND ((cs.session_date + cs.end_time) AT TIME ZONE 'America/Detroit') > p_start) THEN RETURN false; END IF;
  IF public.pt_client_slot_is_open(p_start, st.id, p_trainer_id, p_uid) THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM pt_appointments a WHERE a.instructor_id = p_trainer_id AND a.status = 'scheduled'
                   AND a.starts_at < v_end AND a.ends_at > p_start)
      OR EXISTS (SELECT 1 FROM training_requests q WHERE q.request_kind = 'appointment_request'
                   AND q.request_status IN ('requested','under_review','alternate_offered')
                   AND coalesce(q.confirmed_trainer_id, q.requested_trainer_id) = p_trainer_id
                   AND q.client_user_id IS DISTINCT FROM p_uid
                   AND ((q.preferred_date + q.preferred_time) AT TIME ZONE 'America/Detroit') < v_end
                   AND ((q.preferred_date + q.preferred_time) AT TIME ZONE 'America/Detroit') + interval '60 minutes' > p_start);
END $function$;
