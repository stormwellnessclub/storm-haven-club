CREATE OR REPLACE FUNCTION public.pt_trainer_day_windows_public(p_instructor_id uuid, p_date date)
 RETURNS TABLE(win_start timestamp with time zone, win_end timestamp with time zone, source text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH rep AS (
    SELECT o.start_time, o.end_time FROM pt_trainer_overrides o
     WHERE o.instructor_id = p_instructor_id AND o.kind = 'replace'
       AND p_date BETWEEN o.date AND coalesce(o.end_date, o.date)
  ), base AS (
    SELECT start_time, end_time, 'exception'::text src FROM rep WHERE start_time IS NOT NULL
    UNION ALL
    SELECT v.start_time, v.end_time, 'recurring' FROM pt_trainer_availability v
     WHERE NOT EXISTS (SELECT 1 FROM rep)
       AND v.instructor_id = p_instructor_id AND v.weekday = extract(dow FROM p_date)
       AND v.is_public = true
       AND (v.effective_start IS NULL OR v.effective_start <= p_date)
       AND (v.effective_end IS NULL OR v.effective_end >= p_date)
    UNION ALL
    SELECT o.start_time, o.end_time, 'extra' FROM pt_trainer_overrides o
     WHERE o.instructor_id = p_instructor_id AND o.kind = 'extra'
       AND coalesce(o.is_public, true) = true
       AND p_date BETWEEN o.date AND coalesce(o.end_date, o.date)
  )
  SELECT ((p_date + start_time) AT TIME ZONE 'America/Detroit'),
         ((p_date + end_time) AT TIME ZONE 'America/Detroit'), src
    FROM base WHERE end_time > start_time
$function$;
REVOKE ALL ON FUNCTION public.pt_trainer_day_windows_public(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_trainer_day_windows_public(uuid, date) TO authenticated, service_role;

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
  v_from := greatest(coalesce(p_from, v_today), v_today);
  v_to := v_from + least(greatest(coalesce(p_days, 14), 1), 28) - 1;
  FOR d IN SELECT generate_series(v_from, v_to, interval '1 day')::date LOOP
    FOR w IN SELECT * FROM public.pt_trainer_day_windows_public(p_trainer_id, d) ORDER BY 1 LOOP
      t := w.win_start;
      WHILE t + make_interval(mins => st.duration_minutes) <= w.win_end LOOP
        IF public.pt_client_slot_is_open(t, st.id, p_trainer_id, v_uid)
           AND NOT v_out @> jsonb_build_array(jsonb_build_object('starts_at', t)) THEN
          v_out := v_out || jsonb_build_array(jsonb_build_object('starts_at', t));
        END IF;
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
  v_from := greatest(coalesce(p_from, v_today), v_today);
  v_to := v_from + least(greatest(coalesce(p_days, 14), 1), 28) - 1;
  FOR tr IN
    SELECT i.id, trim(coalesce(i.first_name,'')||' '||coalesce(i.last_name,'')) AS name
      FROM pt_trainer_services ts JOIN instructors i ON i.id = ts.instructor_id
     WHERE ts.session_type_id = st.id AND i.is_active
       AND public.pt_effective_client_booking_mode(i.id) = 'request'
  LOOP
    FOR d IN SELECT generate_series(v_from, v_to, interval '1 day')::date LOOP
      FOR w IN SELECT * FROM public.pt_trainer_day_windows_public(tr.id, d) ORDER BY 1 LOOP
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
  IF p_start <= now() THEN RETURN false; END IF;
  v_end := p_start + make_interval(mins => st.duration_minutes);
  v_date := (p_start AT TIME ZONE 'America/Detroit')::date;
  IF NOT EXISTS (SELECT 1 FROM public.pt_trainer_day_windows_public(p_trainer_id, v_date) w WHERE w.win_start <= p_start AND w.win_end >= v_end) THEN RETURN false; END IF;
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

CREATE OR REPLACE FUNCTION public.pt_client_slot_is_open(p_start timestamp with time zone, p_session_type_id uuid, p_trainer_id uuid, p_uid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE st pt_session_types; v_end timestamptz; r jsonb; v_date date;
BEGIN
  SELECT * INTO st FROM pt_session_types WHERE id = p_session_type_id AND is_active AND client_requestable;
  IF st.id IS NULL OR p_trainer_id IS NULL OR p_start IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM pt_trainer_services WHERE instructor_id = p_trainer_id AND session_type_id = st.id) THEN RETURN false; END IF;
  IF p_start <= now() THEN RETURN false; END IF;
  v_end := p_start + make_interval(mins => st.duration_minutes);
  v_date := (p_start AT TIME ZONE 'America/Detroit')::date;
  IF NOT EXISTS (SELECT 1 FROM public.pt_trainer_day_windows_public(p_trainer_id, v_date) w WHERE w.win_start <= p_start AND w.win_end >= v_end) THEN RETURN false; END IF;
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