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
  v_today date := (now() AT TIME ZONE 'America/Detroit')::date; v_from date; v_to date;
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
          IF public.pt_client_slot_is_open(t, st.id, tr.id, v_uid)
             AND NOT v_out @> jsonb_build_array(jsonb_build_object('starts_at', t, 'trainer_id', tr.id)) THEN
            v_out := v_out || jsonb_build_array(jsonb_build_object('starts_at', t, 'trainer_id', tr.id, 'trainer_name', tr.name,
                       'ends_at', t + make_interval(mins => st.duration_minutes)));
          END IF;
          t := t + interval '60 minutes';
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
  RETURN v_out;
END $function$;

REVOKE ALL ON FUNCTION public.pt_client_request_times_all(uuid, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_client_request_times_all(uuid, date, integer) TO authenticated;