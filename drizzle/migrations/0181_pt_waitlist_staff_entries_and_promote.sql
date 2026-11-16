CREATE OR REPLACE FUNCTION public.pt_schedule_waitlist_entries(p_from date, p_to date)
RETURNS TABLE(id uuid, trainer_id uuid, session_type_id uuid, session_name text, preferred_date date, preferred_time time,
  client_user_id uuid, client_name text, phone text, email text, notes text, status text, created_at timestamptz, line_position int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_all boolean; v_me uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  v_all := public.has_any_role(v_uid, ARRAY['admin','super_admin','manager','front_desk']::app_role[]);
  v_me := public.pt_my_instructor_id(v_uid);
  IF NOT v_all AND v_me IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT w.id, w.preferred_trainer_id, w.session_type_id, st.name, w.preferred_date, w.preferred_time, w.client_user_id,
    nullif(trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),''), p.phone, p.email, w.notes, w.status, w.created_at,
    (row_number() OVER (PARTITION BY w.preferred_trainer_id, w.preferred_date, w.preferred_time ORDER BY w.created_at))::int
  FROM pt_waitlist w
  LEFT JOIN pt_session_types st ON st.id = w.session_type_id
  LEFT JOIN profiles p ON p.id = w.client_user_id
  WHERE w.status IN ('waiting','contacted') AND w.preferred_trainer_id IS NOT NULL AND w.preferred_time IS NOT NULL
    AND w.preferred_date BETWEEN p_from AND p_to AND (v_all OR w.preferred_trainer_id = v_me)
  ORDER BY w.preferred_date, w.preferred_time, w.created_at;
END $$;
REVOKE ALL ON FUNCTION public.pt_schedule_waitlist_entries(date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pt_schedule_waitlist_entries(date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.pt_waitlist_promote(p_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); w pt_waitlist; st pt_session_types; p profiles; v_start timestamptz; v_end timestamptz; v_req uuid;
BEGIN
  SELECT * INTO w FROM pt_waitlist WHERE id = p_id FOR UPDATE;
  IF w.id IS NULL OR w.status NOT IN ('waiting','contacted') THEN RAISE EXCEPTION 'This waitlist entry is no longer active'; END IF;
  IF NOT (public.has_any_role(v_uid, ARRAY['admin','super_admin','manager','front_desk']::app_role[])
          OR public.pt_my_instructor_id(v_uid) = w.preferred_trainer_id) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT * INTO st FROM pt_session_types WHERE id = w.session_type_id;
  v_start := (w.preferred_date + w.preferred_time) AT TIME ZONE 'America/Detroit';
  v_end := v_start + make_interval(mins => coalesce(st.duration_minutes, 60));
  IF EXISTS (SELECT 1 FROM pt_appointments a WHERE a.instructor_id = w.preferred_trainer_id AND a.status = 'scheduled'
              AND a.starts_at < v_end AND a.ends_at > v_start)
     OR EXISTS (SELECT 1 FROM training_requests q WHERE q.request_kind = 'appointment_request'
              AND q.request_status IN ('requested','under_review','alternate_offered')
              AND coalesce(q.confirmed_trainer_id, q.requested_trainer_id) = w.preferred_trainer_id
              AND ((q.preferred_date + q.preferred_time) AT TIME ZONE 'America/Detroit') < v_end
              AND ((q.preferred_date + q.preferred_time) AT TIME ZONE 'America/Detroit') + interval '60 minutes' > v_start) THEN
    RAISE EXCEPTION 'This hour is still held by a request or booked session';
  END IF;
  SELECT * INTO p FROM profiles WHERE id = w.client_user_id;
  INSERT INTO training_requests (service, full_name, email, phone, is_member, request_kind, origin, request_status,
    client_user_id, submitted_by_user_id, requested_trainer_id, pt_session_type_id, preferred_date, preferred_time,
    requested_slot_at, flexibility, client_note)
  VALUES (coalesce(st.name,'Personal Training'), coalesce(nullif(trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),''),'Client'),
    coalesce(p.email,''), coalesce(p.phone,''), false, 'appointment_request', 'staff_created', 'requested',
    w.client_user_id, v_uid, w.preferred_trainer_id, w.session_type_id, w.preferred_date, w.preferred_time,
    v_start, 'exact', coalesce('From waitlist. ' || w.notes, 'From waitlist.'))
  RETURNING id INTO v_req;
  UPDATE pt_waitlist SET status = 'booked', updated_at = now() WHERE id = w.id;
  RETURN v_req;
END $$;
REVOKE ALL ON FUNCTION public.pt_waitlist_promote(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pt_waitlist_promote(uuid) TO authenticated;