CREATE OR REPLACE FUNCTION public.kiosk_todays_attendance()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE
  v_base jsonb;
  v_pt jsonb;
  v_start timestamptz := ((now() AT TIME ZONE 'America/Detroit')::date::timestamp AT TIME ZONE 'America/Detroit');
  v_end timestamptz := (((now() AT TIME ZONE 'America/Detroit')::date + 1)::timestamp AT TIME ZONE 'America/Detroit');
BEGIN
  PERFORM public.assert_kiosk_staff();
  v_base := public.kiosk_todays_attendance_impl();
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', 'pt-' || a.id, 'type', 'pt',
    'name', COALESCE(NULLIF(btrim(concat_ws(' ', m.first_name, m.last_name)), ''), NULLIF(btrim(concat_ws(' ', n.first_name, n.last_name)), ''), NULLIF(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email, 'PT Client'),
    'time', a.checked_in_at,
    'subtitle', concat_ws(' • ', 'Personal Training', i.first_name, l.name),
    'photo_url', m.photo_url,
    'sub_type', CASE WHEN m.id IS NOT NULL THEN 'Member PT' ELSE 'Non-Member PT' END
  ) ORDER BY a.checked_in_at DESC), '[]'::jsonb) INTO v_pt
  FROM public.pt_appointments a
  LEFT JOIN LATERAL (SELECT id, first_name, last_name, photo_url FROM public.members WHERE user_id = a.user_id AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1) m ON true
  LEFT JOIN LATERAL (SELECT first_name, last_name FROM public.non_member_profiles WHERE user_id = a.user_id LIMIT 1) n ON true
  LEFT JOIN LATERAL (SELECT first_name, last_name, email FROM public.profiles WHERE user_id = a.user_id LIMIT 1) p ON true
  LEFT JOIN public.instructors i ON i.id = a.instructor_id
  LEFT JOIN public.pt_locations l ON l.id = a.location_id
  WHERE a.checked_in_at >= v_start AND a.checked_in_at < v_end
    AND a.status IN ('scheduled', 'completed');
  RETURN jsonb_set(jsonb_set(v_base, '{entries}', COALESCE(v_base->'entries', '[]'::jsonb) || v_pt), '{stats}',
    COALESCE(v_base->'stats', '{}'::jsonb) || jsonb_build_object(
      'pt', jsonb_array_length(v_pt),
      'total', COALESCE((v_base->'stats'->>'total')::integer, 0) + jsonb_array_length(v_pt)
    ));
END $f$;
REVOKE ALL ON FUNCTION public.kiosk_todays_attendance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kiosk_todays_attendance() TO authenticated, service_role;