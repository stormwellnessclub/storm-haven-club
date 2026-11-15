DROP FUNCTION IF EXISTS public.pt_request_create(uuid, uuid, date, time, text, text);

CREATE OR REPLACE FUNCTION public.pt_request_create(
  p_session_type_id uuid, p_trainer_id uuid, p_preferred_date date, p_preferred_time time,
  p_flexibility_note text DEFAULT NULL, p_client_note text DEFAULT NULL,
  p_earliest_time time DEFAULT NULL, p_latest_time time DEFAULT NULL, p_flexibility text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_uid uuid := auth.uid(); v_p record; v_st record; v_id uuid; v_member boolean; v_flex text;
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
  v_flex := CASE WHEN p_flexibility IN ('window','exact') THEN p_flexibility ELSE NULL END;
  IF v_flex = 'window' THEN
    IF p_earliest_time IS NULL OR p_latest_time IS NULL OR p_latest_time <= p_earliest_time THEN
      RAISE EXCEPTION 'Choose an availability window that ends after it starts';
    END IF;
    IF p_preferred_time IS NOT NULL AND (p_preferred_time < p_earliest_time OR p_preferred_time >= p_latest_time) THEN
      RAISE EXCEPTION 'Your preferred time must fall inside your availability window';
    END IF;
  END IF;
  SELECT first_name, last_name, email, phone INTO v_p FROM profiles WHERE user_id = v_uid;
  v_member := EXISTS (SELECT 1 FROM members m WHERE m.user_id = v_uid AND m.status <> 'cancelled');
  INSERT INTO training_requests(service, full_name, email, phone, is_member, status, submitted_by_user_id, client_user_id,
    requested_trainer_id, pt_session_type_id, preferred_date, preferred_time, flexibility_note, client_note, request_status,
    earliest_time, latest_time, flexibility)
  VALUES (v_st.name, trim(coalesce(v_p.first_name,'')||' '||coalesce(v_p.last_name,'')), coalesce(v_p.email, public.current_user_email()), coalesce(v_p.phone,''),
    v_member, 'new', v_uid, v_uid, p_trainer_id, p_session_type_id, p_preferred_date, p_preferred_time,
    left(p_flexibility_note, 500), left(p_client_note, 300), 'requested',
    CASE WHEN v_flex = 'window' THEN p_earliest_time END, CASE WHEN v_flex = 'window' THEN p_latest_time END, v_flex)
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;
REVOKE ALL ON FUNCTION public.pt_request_create(uuid, uuid, date, time, text, text, time, time, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_request_create(uuid, uuid, date, time, text, text, time, time, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pt_my_requests()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN '[]'::jsonb ELSE coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', r.id, 'service', r.service, 'created_at', r.created_at,
      'preferred_date', r.preferred_date, 'preferred_time', r.preferred_time,
      'earliest_time', r.earliest_time, 'latest_time', r.latest_time, 'flexibility', r.flexibility,
      'request_status', r.request_status,
      'trainer', nullif(trim(coalesce(ti.first_name,'') || ' ' || coalesce(ti.last_name,'')), ''),
      'alt_date', r.alt_date, 'alt_time', r.alt_time,
      'alt_trainer', nullif(trim(coalesce(ai.first_name,'') || ' ' || coalesce(ai.last_name,'')), ''),
      'client_note', r.client_note, 'appointment_id', r.appointment_id
    ) ORDER BY r.created_at DESC)
    FROM training_requests r
    LEFT JOIN instructors ti ON ti.id = r.requested_trainer_id
    LEFT JOIN instructors ai ON ai.id = r.alt_trainer_id
    WHERE r.request_kind = 'appointment_request'
      AND (r.client_user_id = auth.uid() OR r.submitted_by_user_id = auth.uid())
      AND r.request_status IN ('requested','under_review','alternate_offered')), '[]'::jsonb) END;
$$;
REVOKE ALL ON FUNCTION public.pt_my_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_my_requests() TO authenticated;

DROP POLICY IF EXISTS "Clients read own training requests" ON public.training_requests;