CREATE OR REPLACE FUNCTION public.pt_check_slot(p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_instructor_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid, p_exclude_id uuid DEFAULT NULL::uuid, p_format pt_format DEFAULT NULL::pt_format, p_user_id uuid DEFAULT NULL::uuid, p_session_type_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_conf jsonb; v_client jsonb := '[]'::jsonb; v_avail text := 'available';
  v_date date := (p_starts_at AT TIME ZONE 'America/Detroit')::date;
  v_end_date date := ((p_ends_at - interval '1 second') AT TIME ZONE 'America/Detroit')::date;
  v_block jsonb; v_cap int; v_confirmed int := 0; v_pending int := 0; v_fmt pt_format := p_format;
  v_blocking boolean;
BEGIN
  -- Staff only: this answer contains trainer calendar details clients must never see.
  IF NOT public.pt_is_staff_or_desk(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_ends_at <= p_starts_at THEN RAISE EXCEPTION 'End must be after start'; END IF;
  IF p_session_type_id IS NOT NULL THEN
    SELECT coalesce(v_fmt, format), greatest(capacity,1) INTO v_fmt, v_cap FROM pt_session_types WHERE id = p_session_type_id;
  END IF;

  v_conf := public.pt_check_appointment_conflict(p_starts_at, p_ends_at, p_instructor_id, p_location_id, p_exclude_id, v_fmt);
  v_cap := coalesce(v_cap, (v_conf->>'group_capacity')::int, 1);

  SELECT count(*) INTO v_confirmed FROM pt_appointments a
   WHERE a.starts_at = p_starts_at AND a.ends_at = p_ends_at
     AND a.instructor_id IS NOT DISTINCT FROM p_instructor_id
     AND a.status NOT IN ('cancelled','late_cancel','no_show') AND coalesce(a.is_waitlist,false) = false
     AND (p_exclude_id IS NULL OR a.id <> p_exclude_id);
  IF p_instructor_id IS NOT NULL THEN
    SELECT count(*) INTO v_pending FROM training_requests r
     WHERE r.request_kind = 'appointment_request' AND r.request_status IN ('requested','under_review','alternate_offered')
       AND r.requested_trainer_id = p_instructor_id AND r.preferred_date = v_date
       AND ((r.preferred_date + r.preferred_time) AT TIME ZONE 'America/Detroit') = p_starts_at;
  END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'starts_at', o.starts_at, 'ends_at', o.ends_at, 'instructor_id', o.instructor_id)), '[]'::jsonb)
      INTO v_client FROM pt_appointments o
     WHERE o.user_id = p_user_id AND (p_exclude_id IS NULL OR o.id <> p_exclude_id)
       AND o.status NOT IN ('cancelled','late_cancel','no_show') AND coalesce(o.is_waitlist,false) = false
       AND o.starts_at < p_ends_at AND o.ends_at > p_starts_at;
  END IF;

  IF p_instructor_id IS NOT NULL THEN
    SELECT jsonb_build_object('id', o.id, 'date', o.date, 'end_date', o.end_date, 'start_time', o.start_time, 'end_time', o.end_time, 'note', o.note)
      INTO v_block FROM pt_trainer_overrides o
     WHERE o.instructor_id = p_instructor_id AND o.kind = 'block'
       AND o.date <= v_end_date AND coalesce(o.end_date, o.date) >= v_date
       AND (o.start_time IS NULL OR o.end_time IS NULL OR EXISTS (
             SELECT 1 FROM generate_series(greatest(o.date, v_date), least(coalesce(o.end_date,o.date), v_end_date), interval '1 day') d
              WHERE ((d::date + o.start_time) AT TIME ZONE 'America/Detroit') < p_ends_at
                AND ((d::date + o.end_time) AT TIME ZONE 'America/Detroit') > p_starts_at))
     LIMIT 1;
    IF v_block IS NOT NULL THEN
      v_avail := 'time_off';
    ELSIF NOT public.pt_trainer_has_schedule(p_instructor_id) THEN
      v_avail := 'not_configured';
    ELSIF NOT EXISTS (SELECT 1 FROM public.pt_trainer_day_windows(p_instructor_id, v_date) w
                       WHERE w.win_start <= p_starts_at AND w.win_end >= p_ends_at) THEN
      v_avail := 'outside_hours';
    END IF;
  END IF;

  v_blocking := coalesce((v_conf->>'has_conflict')::boolean, false)
             OR jsonb_array_length(v_client) > 0
             OR v_avail IN ('time_off','outside_hours');

  RETURN v_conf || jsonb_build_object(
    'has_conflict', v_blocking,
    'availability', v_avail,
    'time_off', v_block,
    'client_conflicts', v_client,
    'room_unavailable', jsonb_array_length(coalesce(v_conf->'room_conflicts','[]'::jsonb)) > 0,
    'capacity', v_cap,
    'confirmed', v_confirmed,
    'pending_requests', v_pending,
    'open_spots', greatest(v_cap - v_confirmed, 0));
END $function$;

CREATE OR REPLACE FUNCTION public.pt_request_create(p_session_type_id uuid, p_trainer_id uuid, p_preferred_date date, p_preferred_time time without time zone, p_flexibility_note text DEFAULT NULL::text, p_client_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_p record; v_st record; v_id uuid; v_member boolean;
BEGIN
  -- Client online PT scheduling is not active until the owner approves activation.
  IF NOT public.pt_is_staff_or_desk(auth.uid()) THEN
    RAISE EXCEPTION 'CLIENT_SCHEDULING_NOT_ACTIVE: online PT requests are coming soon';
  END IF;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to request a session'; END IF;
  PERFORM public.pt_assert_client_request_allowed(p_trainer_id);
  SELECT * INTO v_st FROM pt_session_types WHERE id = p_session_type_id AND is_active;
  IF v_st.id IS NULL THEN RAISE EXCEPTION 'Unknown session type'; END IF;
  IF p_preferred_date IS NULL OR p_preferred_date < (now() AT TIME ZONE 'America/Detroit')::date THEN RAISE EXCEPTION 'Choose a future date'; END IF;
  SELECT first_name, last_name, email, phone INTO v_p FROM profiles WHERE user_id = v_uid;
  v_member := EXISTS (SELECT 1 FROM members m WHERE m.user_id = v_uid AND m.status <> 'cancelled');
  INSERT INTO training_requests(service, full_name, email, phone, is_member, status, submitted_by_user_id, client_user_id,
    requested_trainer_id, pt_session_type_id, preferred_date, preferred_time, flexibility_note, client_note, request_status)
  VALUES (v_st.name, trim(coalesce(v_p.first_name,'')||' '||coalesce(v_p.last_name,'')), coalesce(v_p.email, public.current_user_email()), coalesce(v_p.phone,''),
    v_member, 'new', v_uid, v_uid, p_trainer_id, p_session_type_id, p_preferred_date, p_preferred_time,
    left(p_flexibility_note, 500), left(p_client_note, 2000), 'requested')
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

REVOKE EXECUTE ON FUNCTION public.pt_trainer_day_windows(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_trainer_day_windows(uuid, date) TO service_role;
REVOKE EXECUTE ON FUNCTION public.pt_trainer_has_schedule(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_trainer_has_schedule(uuid) TO service_role;