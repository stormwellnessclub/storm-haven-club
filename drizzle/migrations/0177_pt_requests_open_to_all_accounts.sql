CREATE OR REPLACE FUNCTION public.pt_assert_client_request_allowed(_instructor_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to request a session'; END IF;
  -- Any signed-in account may request (the club decides); only blocked people are refused.
  IF public.is_email_blocked(coalesce(public.current_user_email(), '')) THEN
    RAISE EXCEPTION 'REQUESTS_CLOSED: Please contact the club to request a session.';
  END IF;
  IF public.pt_effective_client_booking_mode(_instructor_id) <> 'request' THEN
    RAISE EXCEPTION 'REQUESTS_CLOSED: Online session requests are not open right now. Please contact the club.';
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.pt_client_request_options()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF public.pt_effective_client_booking_mode(NULL) <> 'request' THEN
    RETURN jsonb_build_object('open', false, 'reason', 'closed', 'services', '[]'::jsonb);
  END IF;
  IF v_uid IS NULL OR public.is_email_blocked(coalesce(public.current_user_email(), '')) THEN
    RETURN jsonb_build_object('open', false, 'reason', 'not_allowed', 'services', '[]'::jsonb);
  END IF;
  RETURN jsonb_build_object('open', true, 'reason', null, 'is_pt_client', public.pt_is_client(v_uid), 'services', coalesce((
    SELECT jsonb_agg(x.obj ORDER BY x.ord, x.name) FROM (
      SELECT st.name, coalesce(array_position(ARRAY['semi_private','pt','reformer','mat_pilates'], st.code), 99) AS ord,
        jsonb_build_object('id', st.id,
          'name', CASE WHEN st.code = 'pt' THEN 'One-on-One Personal Training' ELSE st.name END,
          'duration_minutes', st.duration_minutes,
          'trainers', coalesce((SELECT jsonb_agg(jsonb_build_object('id', i.id,
                'name', trim(coalesce(i.first_name,'')||' '||coalesce(i.last_name,''))) ORDER BY i.first_name)
              FROM pt_trainer_services ts JOIN instructors i ON i.id = ts.instructor_id
             WHERE ts.session_type_id = st.id AND i.is_active
               AND public.pt_effective_client_booking_mode(i.id) = 'request'), '[]'::jsonb)) AS obj
      FROM pt_session_types st WHERE st.is_active AND st.client_requestable) x
    WHERE jsonb_array_length(x.obj->'trainers') > 0), '[]'::jsonb));
END $function$;