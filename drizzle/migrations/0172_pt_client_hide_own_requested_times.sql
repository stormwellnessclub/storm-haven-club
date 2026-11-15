DO $do$
DECLARE v text;
BEGIN
  v := pg_get_functiondef('public.pt_client_slot_is_open(timestamptz,uuid,uuid,uuid)'::regprocedure);
  v := replace(v, $q$  r := public.pt_check_slot_core($q$, $q$  IF p_uid IS NOT NULL AND EXISTS (SELECT 1 FROM training_requests q WHERE q.client_user_id = p_uid
       AND q.request_kind = 'appointment_request' AND q.request_status IN ('requested','under_review','alternate_offered')
       AND q.preferred_date = v_date AND ((q.preferred_date + q.preferred_time) AT TIME ZONE 'America/Detroit') = p_start) THEN RETURN false; END IF;
  r := public.pt_check_slot_core($q$);
  IF position('q.client_user_id = p_uid' in v) = 0 THEN RAISE EXCEPTION 'rewrite failed'; END IF;
  EXECUTE v;
END $do$;
REVOKE ALL ON FUNCTION public.pt_client_slot_is_open(timestamptz, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;