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
  IF v_uid IS NULL OR NOT public.pt_is_client(v_uid) THEN
    RETURN jsonb_build_object('open', false, 'reason', 'not_client', 'services', '[]'::jsonb);
  END IF;
  RETURN jsonb_build_object('open', true, 'reason', null, 'services', coalesce((
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