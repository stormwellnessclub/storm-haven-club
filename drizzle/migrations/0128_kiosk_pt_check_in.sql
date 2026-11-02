CREATE OR REPLACE FUNCTION public.kiosk_search_pt_impl(p_query text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE v_results jsonb := '[]'::jsonb; r record; v_name text;
BEGIN
  FOR r IN
    SELECT a.id, a.starts_at,
           m.first_name AS m_first, m.last_name AS m_last,
           nmp.first_name AS nmp_first, nmp.last_name AS nmp_last,
           p.first_name AS p_first, p.last_name AS p_last,
           i.first_name AS i_first, l.name AS loc_name
    FROM public.pt_appointments a
    LEFT JOIN public.members m ON m.user_id = a.user_id AND m.status <> 'cancelled'
    LEFT JOIN public.non_member_profiles nmp ON nmp.user_id = a.user_id
    LEFT JOIN public.profiles p ON p.user_id = a.user_id
    LEFT JOIN public.instructors i ON i.id = a.instructor_id
    LEFT JOIN public.pt_locations l ON l.id = a.location_id
    WHERE (a.starts_at AT TIME ZONE 'America/Detroit')::date = (now() AT TIME ZONE 'America/Detroit')::date
      AND a.status = 'scheduled'
      AND a.checked_in_at IS NULL
      AND (
        (m.first_name || ' ' || m.last_name) ILIKE '%' || p_query || '%'
        OR (nmp.first_name || ' ' || nmp.last_name) ILIKE '%' || p_query || '%'
        OR (p.first_name || ' ' || p.last_name) ILIKE '%' || p_query || '%'
        OR p.email ILIKE '%' || p_query || '%'
        OR p.phone ILIKE '%' || p_query || '%'
      )
    LIMIT 10
  LOOP
    v_name := coalesce(
      nullif(trim(coalesce(r.m_first,'') || ' ' || coalesce(r.m_last,'')), ''),
      nullif(trim(coalesce(r.nmp_first,'') || ' ' || coalesce(r.nmp_last,'')), ''),
      nullif(trim(coalesce(r.p_first,'') || ' ' || coalesce(r.p_last,'')), ''),
      'Unknown');
    v_results := v_results || jsonb_build_object(
      'id', 'pt-' || r.id,
      'type', 'pt_appointment',
      'name', v_name,
      'subtitle', 'Personal Training • ' || to_char(r.starts_at AT TIME ZONE 'America/Detroit', 'FMHH12:MI AM')
                  || COALESCE(' • ' || r.i_first, '') || COALESCE(' • ' || r.loc_name, ''),
      'pt_id', r.id,
      'sub_type', CASE WHEN r.m_first IS NOT NULL THEN 'Member PT' ELSE 'Non-Member PT' END
    );
  END LOOP;
  RETURN v_results;
END $f$;

CREATE OR REPLACE FUNCTION public.kiosk_search_visitors(p_query text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
BEGIN
  PERFORM public.assert_kiosk_staff();
  PERFORM set_config('TimeZone', 'America/Detroit', true);
  RETURN public.kiosk_search_visitors_impl(p_query) || public.kiosk_search_pt_impl(p_query);
END $f$;

CREATE OR REPLACE FUNCTION public.kiosk_check_in_pt(p_pt_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE v_at timestamptz;
BEGIN
  PERFORM public.assert_kiosk_staff();
  UPDATE public.pt_appointments
     SET checked_in_at = COALESCE(checked_in_at, now()),
         checked_in_by = COALESCE(checked_in_by, auth.uid())
   WHERE id = p_pt_id AND status IN ('scheduled','completed')
  RETURNING checked_in_at INTO v_at;
  IF v_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found or cancelled');
  END IF;
  RETURN jsonb_build_object('success', true, 'checked_in_at', v_at);
END $f$;

CREATE OR REPLACE FUNCTION public.kiosk_todays_pt()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
BEGIN
  PERFORM public.assert_kiosk_staff();
  RETURN COALESCE((
    SELECT jsonb_agg(x ORDER BY x->>'starts_at') FROM (
      SELECT jsonb_build_object(
        'id', a.id, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'format', a.format,
        'checked_in_at', a.checked_in_at,
        'name', coalesce(
           nullif(trim(coalesce(m.first_name,'') || ' ' || coalesce(m.last_name,'')), ''),
           nullif(trim(coalesce(nmp.first_name,'') || ' ' || coalesce(nmp.last_name,'')), ''),
           nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''), 'Unknown'),
        'is_member', m.id IS NOT NULL,
        'trainer', trim(coalesce(i.first_name,'') || ' ' || coalesce(i.last_name,'')),
        'location', l.name) AS x
      FROM public.pt_appointments a
      LEFT JOIN public.members m ON m.user_id = a.user_id AND m.status <> 'cancelled'
      LEFT JOIN public.non_member_profiles nmp ON nmp.user_id = a.user_id
      LEFT JOIN public.profiles p ON p.user_id = a.user_id
      LEFT JOIN public.instructors i ON i.id = a.instructor_id
      LEFT JOIN public.pt_locations l ON l.id = a.location_id
      WHERE (a.starts_at AT TIME ZONE 'America/Detroit')::date = (now() AT TIME ZONE 'America/Detroit')::date
        AND a.status IN ('scheduled','completed')
    ) s), '[]'::jsonb);
END $f$;

REVOKE ALL ON FUNCTION public.kiosk_search_pt_impl(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kiosk_check_in_pt(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kiosk_todays_pt() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kiosk_check_in_pt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_todays_pt() TO authenticated;