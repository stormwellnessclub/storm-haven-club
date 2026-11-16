CREATE OR REPLACE FUNCTION public.pt_request_client_cancel(p_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); r training_requests;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to manage your requests'; END IF;
  SELECT * INTO r FROM training_requests WHERE id = p_request_id FOR UPDATE;
  IF r.id IS NULL OR r.request_kind <> 'appointment_request'
     OR NOT (r.client_user_id = v_uid OR r.submitted_by_user_id = v_uid) THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF r.request_status NOT IN ('requested','under_review','alternate_offered','waitlisted') THEN
    RAISE EXCEPTION 'This request can no longer be cancelled here. If it was confirmed, cancel the session instead.';
  END IF;
  UPDATE training_requests SET request_status = 'cancelled', resolved_at = now(), resolved_by = v_uid,
    decline_reason = coalesce(decline_reason, 'Cancelled by client'), updated_at = now()
   WHERE id = r.id;
END $function$;

CREATE OR REPLACE FUNCTION public.pt_request_client_change(p_request_id uuid, p_trainer_id uuid, p_slot_starts_at timestamptz)
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

REVOKE ALL ON FUNCTION public.pt_request_client_cancel(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pt_request_client_change(uuid, uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_request_client_cancel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pt_request_client_change(uuid, uuid, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.pt_my_requests()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN auth.uid() IS NULL THEN '[]'::jsonb ELSE coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', r.id, 'service', coalesce(st.name, r.service), 'created_at', r.created_at,
      'session_type_id', r.pt_session_type_id,
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
$function$;

CREATE OR REPLACE FUNCTION public.pt_schedule_pending_requests(p_from timestamptz, p_to timestamptz)
 RETURNS TABLE(id uuid, starts_at timestamptz, duration_minutes integer, trainer_id uuid, session_type_id uuid,
               session_name text, client_name text, request_status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_all boolean; v_me uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  v_all := public.has_any_role(v_uid, ARRAY['admin','super_admin','manager','front_desk']::app_role[]);
  v_me := public.pt_my_instructor_id(v_uid);
  IF NOT v_all AND v_me IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT x.id, x.starts_at, x.duration_minutes, x.trainer_id, x.session_type_id, x.session_name, x.client_name, x.request_status
  FROM (
    SELECT q.id,
      CASE WHEN q.request_status = 'alternate_offered' AND q.alt_date IS NOT NULL AND q.alt_time IS NOT NULL
           THEN (q.alt_date + q.alt_time) AT TIME ZONE 'America/Detroit'
           ELSE coalesce(q.requested_slot_at, (q.preferred_date + q.preferred_time) AT TIME ZONE 'America/Detroit') END AS starts_at,
      coalesce(st.duration_minutes, 60) AS duration_minutes,
      CASE WHEN q.request_status = 'alternate_offered' AND q.alt_trainer_id IS NOT NULL THEN q.alt_trainer_id ELSE q.requested_trainer_id END AS trainer_id,
      q.pt_session_type_id AS session_type_id,
      coalesce(st.name, q.service) AS session_name,
      nullif(trim(coalesce(q.full_name,'')), '') AS client_name,
      q.request_status
    FROM training_requests q
    LEFT JOIN pt_session_types st ON st.id = q.pt_session_type_id
    WHERE q.request_kind = 'appointment_request'
      AND q.request_status IN ('requested','under_review','alternate_offered')
      AND q.preferred_date IS NOT NULL AND q.preferred_time IS NOT NULL
  ) x
  WHERE x.starts_at >= p_from AND x.starts_at <= p_to
    AND (v_all OR x.trainer_id = v_me)
  ORDER BY x.starts_at;
END $function$;

REVOKE ALL ON FUNCTION public.pt_schedule_pending_requests(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_schedule_pending_requests(timestamptz, timestamptz) TO authenticated;