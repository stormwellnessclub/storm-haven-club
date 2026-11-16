CREATE OR REPLACE FUNCTION public.pt_client_slot_is_full(p_start timestamptz, p_session_type_id uuid, p_trainer_id uuid, p_uid uuid)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$
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
END $f$;
REVOKE ALL ON FUNCTION public.pt_client_slot_is_full(timestamptz, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pt_client_request_times_all(p_session_type_id uuid, p_from date DEFAULT NULL::date, p_days integer DEFAULT 14)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.pt_waitlist_join(p_session_type_id uuid, p_trainer_id uuid, p_starts_at timestamptz, p_notes text DEFAULT NULL)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $f$
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
END $f$;

CREATE OR REPLACE FUNCTION public.pt_waitlist_leave(p_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $f$
BEGIN
  UPDATE pt_waitlist SET status = 'closed', updated_at = now()
   WHERE id = p_id AND client_user_id = auth.uid() AND status = 'waiting';
  IF NOT FOUND THEN RAISE EXCEPTION 'Waitlist entry not found'; END IF;
END $f$;

CREATE OR REPLACE FUNCTION public.pt_my_waitlist()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'preferred_date', w.preferred_date, 'preferred_time', w.preferred_time,
     'trainer_name', trim(coalesce(i.first_name,'')||' '||coalesce(i.last_name,'')), 'session_name', st.name,
     'status', w.status, 'notes', w.notes, 'created_at', w.created_at) ORDER BY w.preferred_date, w.preferred_time), '[]'::jsonb)
  FROM pt_waitlist w LEFT JOIN instructors i ON i.id = w.preferred_trainer_id LEFT JOIN pt_session_types st ON st.id = w.session_type_id
  WHERE w.client_user_id = auth.uid() AND w.status IN ('waiting','contacted')
    AND (w.preferred_date IS NULL OR w.preferred_date >= (now() AT TIME ZONE 'America/Detroit')::date);
$f$;

CREATE OR REPLACE FUNCTION public.pt_schedule_waitlist(p_from date, p_to date)
 RETURNS TABLE(trainer_id uuid, preferred_date date, preferred_time time, waiting integer)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$
BEGIN
  IF NOT public.pt_is_staff_or_desk(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN QUERY SELECT w.preferred_trainer_id, w.preferred_date, w.preferred_time, count(*)::int
    FROM pt_waitlist w WHERE w.status = 'waiting' AND w.preferred_trainer_id IS NOT NULL
     AND w.preferred_date BETWEEN p_from AND p_to AND w.preferred_time IS NOT NULL
    GROUP BY 1,2,3;
END $f$;

REVOKE ALL ON FUNCTION public.pt_waitlist_join(uuid, uuid, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pt_waitlist_leave(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pt_my_waitlist() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pt_schedule_waitlist(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_waitlist_join(uuid, uuid, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pt_waitlist_leave(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pt_my_waitlist() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pt_schedule_waitlist(date, date) TO authenticated;