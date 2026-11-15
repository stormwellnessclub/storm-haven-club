ALTER TABLE public.pt_session_types ADD COLUMN IF NOT EXISTS client_requestable boolean NOT NULL DEFAULT false;
UPDATE public.pt_session_types SET client_requestable = true WHERE code IN ('pt','semi_private','reformer','mat_pilates');

ALTER TABLE public.training_requests ADD COLUMN IF NOT EXISTS requested_slot_at timestamptz;
ALTER TABLE public.training_requests DROP CONSTRAINT IF EXISTS training_requests_request_status_chk;
ALTER TABLE public.training_requests ADD CONSTRAINT training_requests_request_status_chk CHECK (request_status = ANY (ARRAY['requested','under_review','alternate_offered','confirmed','declined','cancelled','waitlisted']));

-- Trainers who offer a PT service (e.g. Bea for Reformer/Mat) follow the global request mode.
CREATE OR REPLACE FUNCTION public.pt_effective_client_booking_mode(_instructor_id uuid)
 RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_global text; v_override text; v_mode text;
BEGIN
  v_global := coalesce((SELECT client_booking_mode FROM public.pt_client_booking_settings WHERE id), 'off');
  IF v_global = 'off' THEN RETURN 'off'; END IF;
  IF _instructor_id IS NULL THEN
    v_mode := v_global;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.instructors WHERE id = _instructor_id AND is_active) THEN RETURN 'off'; END IF;
    v_override := coalesce((SELECT client_booking_mode FROM public.pt_trainer_client_booking WHERE instructor_id = _instructor_id), 'follow');
    IF v_override = 'hidden' THEN RETURN 'off'; END IF;
    IF v_override = 'follow' THEN
      IF NOT (public.pt_is_pt_trainer(_instructor_id)
              OR EXISTS (SELECT 1 FROM public.pt_trainer_services s WHERE s.instructor_id = _instructor_id)) THEN RETURN 'off'; END IF;
      v_mode := v_global;
    ELSE
      v_mode := v_override;
    END IF;
  END IF;
  IF v_mode = 'instant' AND NOT public.pt_instant_booking_ready() THEN RETURN 'off'; END IF;
  RETURN v_mode;
END $function$;

-- Internal (no auth check) copies of the slot engine, callable only from other server functions.
DO $do$
DECLARE v text;
BEGIN
  v := pg_get_functiondef('public.pt_check_appointment_conflict(timestamptz,timestamptz,uuid,uuid,uuid,pt_format)'::regprocedure);
  v := replace(v, 'FUNCTION public.pt_check_appointment_conflict(', 'FUNCTION public.pt_check_appointment_conflict_core(');
  v := replace(v, 'IF NOT public.pt_is_staff_or_desk(auth.uid())', 'IF false AND NOT public.pt_is_staff_or_desk(auth.uid())');
  IF position('IF false AND' in v) = 0 THEN RAISE EXCEPTION 'conflict core rewrite failed'; END IF;
  EXECUTE v;
  v := pg_get_functiondef('public.pt_check_slot(timestamptz,timestamptz,uuid,uuid,uuid,pt_format,uuid,uuid)'::regprocedure);
  v := replace(v, 'FUNCTION public.pt_check_slot(', 'FUNCTION public.pt_check_slot_core(');
  v := replace(v, 'IF NOT public.pt_is_staff_or_desk(auth.uid())', 'IF false AND NOT public.pt_is_staff_or_desk(auth.uid())');
  v := replace(v, 'public.pt_check_appointment_conflict(', 'public.pt_check_appointment_conflict_core(');
  IF position('IF false AND' in v) = 0 OR position('pt_check_appointment_conflict_core(' in v) = 0 THEN RAISE EXCEPTION 'slot core rewrite failed'; END IF;
  EXECUTE v;
END $do$;
REVOKE ALL ON FUNCTION public.pt_check_appointment_conflict_core(timestamptz,timestamptz,uuid,uuid,uuid,pt_format) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pt_check_slot_core(timestamptz,timestamptz,uuid,uuid,uuid,pt_format,uuid,uuid) FROM PUBLIC, anon, authenticated;

-- One yes/no answer: is this start time open for this client to request? No reasons are returned.
CREATE OR REPLACE FUNCTION public.pt_client_slot_is_open(p_start timestamptz, p_session_type_id uuid, p_trainer_id uuid, p_uid uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
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
  r := public.pt_check_slot_core(p_start, v_end, p_trainer_id, st.default_location_id, NULL, st.format, p_uid, st.id);
  IF coalesce((r->>'has_conflict')::boolean, true) OR coalesce(r->>'availability','') <> 'available' THEN RETURN false; END IF;
  IF coalesce((r->>'confirmed')::int,0) + coalesce((r->>'pending_requests')::int,0) >= coalesce((r->>'capacity')::int,1) THEN RETURN false; END IF;
  RETURN true;
END $function$;
REVOKE ALL ON FUNCTION public.pt_client_slot_is_open(timestamptz, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Client-safe request menu: requestable services and the trainers who offer each one.
CREATE OR REPLACE FUNCTION public.pt_client_request_options()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.pt_is_client(v_uid) OR public.pt_effective_client_booking_mode(NULL) <> 'request' THEN
    RETURN jsonb_build_object('open', false, 'services', '[]'::jsonb);
  END IF;
  RETURN jsonb_build_object('open', true, 'services', coalesce((
    SELECT jsonb_agg(x.obj ORDER BY x.ord, x.name) FROM (
      SELECT st.name, coalesce(array_position(ARRAY['pt','semi_private','reformer','mat_pilates'], st.code), 99) AS ord,
        jsonb_build_object('id', st.id, 'name', st.name, 'duration_minutes', st.duration_minutes,
          'trainers', coalesce((SELECT jsonb_agg(jsonb_build_object('id', i.id,
                'name', trim(coalesce(i.first_name,'')||' '||coalesce(i.last_name,''))) ORDER BY i.first_name)
              FROM pt_trainer_services ts JOIN instructors i ON i.id = ts.instructor_id
             WHERE ts.session_type_id = st.id AND i.is_active
               AND public.pt_effective_client_booking_mode(i.id) = 'request'), '[]'::jsonb)) AS obj
      FROM pt_session_types st WHERE st.is_active AND st.client_requestable) x
    WHERE jsonb_array_length(x.obj->'trainers') > 0), '[]'::jsonb));
END $function$;
REVOKE ALL ON FUNCTION public.pt_client_request_options() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_client_request_options() TO authenticated;

-- Client-safe open start times for one trainer + service. Returns start times only.
CREATE OR REPLACE FUNCTION public.pt_client_request_times(p_session_type_id uuid, p_trainer_id uuid, p_from date DEFAULT NULL, p_days int DEFAULT 14)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
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
        t := t + interval '30 minutes';
      END LOOP;
    END LOOP;
  END LOOP;
  RETURN v_out;
END $function$;
REVOKE ALL ON FUNCTION public.pt_client_request_times(uuid, uuid, date, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_client_request_times(uuid, uuid, date, int) TO authenticated;

-- Client request creation: picked open time (primary) or "request another time" fallback.
DROP FUNCTION IF EXISTS public.pt_request_create(uuid, uuid, date, time, text, text, time, time, text);
CREATE OR REPLACE FUNCTION public.pt_request_create(
  p_session_type_id uuid, p_trainer_id uuid, p_preferred_date date DEFAULT NULL, p_preferred_time time DEFAULT NULL,
  p_flexibility_note text DEFAULT NULL, p_client_note text DEFAULT NULL,
  p_earliest_time time DEFAULT NULL, p_latest_time time DEFAULT NULL, p_flexibility text DEFAULT NULL,
  p_slot_starts_at timestamptz DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
        AND q.request_status IN ('requested','under_review','alternate_offered')) >= 5 THEN
    RAISE EXCEPTION 'You already have 5 requests waiting. Please wait for the club to reply before sending more.';
  END IF;
  IF p_slot_starts_at IS NOT NULL THEN
    IF p_trainer_id IS NULL THEN RAISE EXCEPTION 'Choose a trainer'; END IF;
    IF NOT public.pt_client_slot_is_open(p_slot_starts_at, v_st.id, p_trainer_id, v_uid) THEN
      RAISE EXCEPTION 'SLOT_TAKEN: That time is no longer available. Please choose another time.';
    END IF;
    v_date := (p_slot_starts_at AT TIME ZONE 'America/Detroit')::date;
    v_time := (p_slot_starts_at AT TIME ZONE 'America/Detroit')::time;
    v_flex := 'exact'; v_e := NULL; v_l := NULL;
  ELSE
    IF v_date IS NULL OR v_date <= (now() AT TIME ZONE 'America/Detroit')::date THEN RAISE EXCEPTION 'Choose a date from tomorrow onward'; END IF;
    IF v_time IS NULL THEN RAISE EXCEPTION 'Choose a preferred time'; END IF;
    v_flex := CASE WHEN p_flexibility IN ('window','exact') THEN p_flexibility ELSE 'exact' END;
    IF v_flex = 'window' THEN
      IF v_e IS NULL OR v_l IS NULL OR v_l <= v_e THEN RAISE EXCEPTION 'Choose an availability window that ends after it starts'; END IF;
      IF v_time < v_e OR v_time >= v_l THEN RAISE EXCEPTION 'Your preferred time must fall inside your availability window'; END IF;
    ELSE
      v_e := NULL; v_l := NULL;
    END IF;
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
REVOKE ALL ON FUNCTION public.pt_request_create(uuid, uuid, date, time, text, text, time, time, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_request_create(uuid, uuid, date, time, text, text, time, time, text, timestamptz) TO authenticated;

-- Client view of their own requests in every status (no staff notes or internal reasons).
CREATE OR REPLACE FUNCTION public.pt_my_requests()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN '[]'::jsonb ELSE coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', r.id, 'service', coalesce(st.name, r.service), 'created_at', r.created_at,
      'preferred_date', r.preferred_date, 'preferred_time', r.preferred_time,
      'earliest_time', r.earliest_time, 'latest_time', r.latest_time, 'flexibility', r.flexibility,
      'request_status', r.request_status,
      'trainer', nullif(trim(coalesce(ti.first_name,'') || ' ' || coalesce(ti.last_name,'')), ''),
      'alt_date', r.alt_date, 'alt_time', r.alt_time,
      'alt_trainer', nullif(trim(coalesce(ai.first_name,'') || ' ' || coalesce(ai.last_name,'')), ''),
      'confirmed_starts_at', r.confirmed_starts_at,
      'client_note', r.client_note, 'appointment_id', r.appointment_id
    ) ORDER BY r.created_at DESC)
    FROM training_requests r
    LEFT JOIN pt_session_types st ON st.id = r.pt_session_type_id
    LEFT JOIN instructors ti ON ti.id = r.requested_trainer_id
    LEFT JOIN instructors ai ON ai.id = r.alt_trainer_id
    WHERE r.request_kind = 'appointment_request'
      AND (r.client_user_id = auth.uid() OR r.submitted_by_user_id = auth.uid())
      AND (r.request_status IN ('requested','under_review','alternate_offered') OR r.created_at > now() - interval '120 days')), '[]'::jsonb) END;
$$;
REVOKE ALL ON FUNCTION public.pt_my_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_my_requests() TO authenticated;

-- Staff: closed statuses include waitlisted; add "waitlist" action.
DO $do$
DECLARE v text;
BEGIN
  v := pg_get_functiondef('public.pt_request_confirm(uuid,boolean,time)'::regprocedure);
  v := replace(v, $q$IN ('declined','cancelled') THEN RAISE$q$, $q$IN ('declined','cancelled','waitlisted') THEN RAISE$q$);
  IF position('''waitlisted''' in v) = 0 THEN RAISE EXCEPTION 'confirm rewrite failed'; END IF;
  EXECUTE v;
  v := pg_get_functiondef('public.pt_request_update(uuid,text,text,uuid,date,time,uuid,uuid)'::regprocedure);
  v := replace(v, $q$IN ('confirmed','declined','cancelled') THEN RAISE$q$, $q$IN ('confirmed','declined','cancelled','waitlisted') THEN RAISE$q$);
  v := replace(v, $q$  ELSE RAISE EXCEPTION 'Unknown action'; END IF;$q$, $q$  ELSIF p_action = 'waitlist' THEN
    IF r.client_user_id IS NULL THEN RAISE EXCEPTION 'Link this request to a client account before adding to the waitlist'; END IF;
    INSERT INTO pt_waitlist (client_user_id, preferred_trainer_id, session_type_id, preferred_date, preferred_time, earliest_time, latest_time, flexibility, notes, created_by)
    VALUES (r.client_user_id, r.requested_trainer_id, r.pt_session_type_id, r.preferred_date, r.preferred_time, r.earliest_time, r.latest_time,
      CASE WHEN r.flexibility IN ('exact','window','any_time_that_day','any_day') THEN r.flexibility ELSE 'window' END,
      left(concat_ws(' — ', nullif(r.client_note,''), nullif(p_reason,'')), 1000), auth.uid());
    UPDATE training_requests SET request_status='waitlisted', resolved_at=now(), resolved_by=auth.uid(), updated_at=now() WHERE id=r.id RETURNING * INTO r;
  ELSE RAISE EXCEPTION 'Unknown action'; END IF;$q$);
  IF position('''waitlist''' in v) = 0 OR position('''waitlisted'') THEN RAISE' in v) = 0 THEN RAISE EXCEPTION 'update rewrite failed'; END IF;
  EXECUTE v;
END $do$;