CREATE OR REPLACE FUNCTION public.kiosk_todays_attendance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_results jsonb := '[]'::jsonb;
  v_today_start timestamptz := (date_trunc('day', (now() AT TIME ZONE 'America/Detroit')) AT TIME ZONE 'America/Detroit');
  v_today_end timestamptz := v_today_start + interval '1 day';
  v_currently_in_cutoff timestamptz := now() - interval '12 hours';
  r record;
  v_currently_in int;
  v_member_count int := 0;
  v_guest_count int := 0;
  v_class_count int := 0;
  v_spa_count int := 0;
  v_name text;
  v_sub_type text;
BEGIN
  FOR r IN
    SELECT ci.id, ci.checked_in_at, ci.checked_out_at, ci.notes,
           m.first_name, m.last_name, m.member_id, m.membership_type, m.photo_url
    FROM public.check_ins ci
    JOIN public.members m ON m.id = ci.member_id
    WHERE ci.checked_in_at >= v_today_start AND ci.checked_in_at < v_today_end
    ORDER BY ci.checked_in_at DESC
  LOOP
    v_member_count := v_member_count + 1;
    v_results := v_results || jsonb_build_object(
      'id', 'member-' || r.id,
      'type', 'member',
      'name', btrim(concat_ws(' ', r.first_name, r.last_name)),
      'time', r.checked_in_at,
      'subtitle', concat_ws(' • ', nullif(r.member_id, ''), nullif(r.membership_type, '')),
      'photo_url', r.photo_url,
      'sub_type', 'Member',
      'is_first_visit', COALESCE(r.notes ILIKE 'First club visit%', false)
    );
  END LOOP;

  FOR r IN
    SELECT id, guest_name, guest_email, used_at
    FROM public.guest_passes
    WHERE status = 'used'
      AND used_at >= v_today_start
      AND used_at < v_today_end
  LOOP
    v_guest_count := v_guest_count + 1;
    v_results := v_results || jsonb_build_object(
      'id', 'guest-' || r.id,
      'type', 'guest',
      'name', COALESCE(NULLIF(r.guest_name, ''), r.guest_email, 'Guest'),
      'time', r.used_at,
      'subtitle', COALESCE(r.guest_email, 'Guest Pass'),
      'sub_type', 'Guest Pass'
    );
  END LOOP;

  FOR r IN
    SELECT cb.id, cb.checked_in_at, cb.walk_in_name, cb.walk_in_email, cb.user_id, cb.member_id, cb.payment_method,
           m.first_name AS m_first, m.last_name AS m_last,
           nmp.first_name AS nmp_first, nmp.last_name AS nmp_last, nmp.email AS nmp_email,
           p.first_name AS p_first, p.last_name AS p_last, p.email AS p_email,
           ct.name AS class_name
    FROM public.class_bookings cb
    JOIN public.class_sessions cs ON cs.id = cb.session_id
    LEFT JOIN public.class_types ct ON ct.id = cs.class_type_id
    LEFT JOIN public.members m ON m.id = cb.member_id
    LEFT JOIN public.non_member_profiles nmp ON nmp.user_id = cb.user_id AND cb.member_id IS NULL
    LEFT JOIN public.profiles p ON p.user_id = cb.user_id AND cb.member_id IS NULL
    WHERE cb.checked_in_at IS NOT NULL
      AND cb.checked_in_at >= v_today_start
      AND cb.checked_in_at < v_today_end
  LOOP
    IF r.m_first IS NOT NULL OR r.m_last IS NOT NULL THEN
      v_name := NULLIF(btrim(concat_ws(' ', r.m_first, r.m_last)), '');
      v_sub_type := 'Class Attendee';
    ELSIF r.nmp_first IS NOT NULL OR r.nmp_last IS NOT NULL THEN
      v_name := COALESCE(NULLIF(btrim(concat_ws(' ', r.nmp_first, r.nmp_last)), ''), r.nmp_email);
      v_sub_type := 'Non-Member • Class Attendee';
    ELSIF r.p_first IS NOT NULL OR r.p_last IS NOT NULL THEN
      v_name := COALESCE(NULLIF(btrim(concat_ws(' ', r.p_first, r.p_last)), ''), r.p_email);
      v_sub_type := 'Non-Member • Class Attendee';
    ELSIF r.walk_in_name IS NOT NULL OR r.walk_in_email IS NOT NULL THEN
      v_name := COALESCE(NULLIF(r.walk_in_name, ''), r.walk_in_email);
      v_sub_type := 'Guest • Class Attendee';
    ELSE
      v_name := 'Class Attendee';
      v_sub_type := 'Class Attendee';
    END IF;

    v_class_count := v_class_count + 1;
    v_results := v_results || jsonb_build_object(
      'id', 'class-' || r.id,
      'type', 'class',
      'name', COALESCE(v_name, 'Class Attendee'),
      'time', r.checked_in_at,
      'subtitle', COALESCE(r.class_name, 'Class'),
      'sub_type', v_sub_type
    );
  END LOOP;

  FOR r IN
    SELECT sa.id, sa.checked_in_at, sa.service_name, sa.user_id, sa.member_id,
           m.first_name AS m_first, m.last_name AS m_last,
           nmp.first_name AS nmp_first, nmp.last_name AS nmp_last, nmp.email AS nmp_email,
           p.first_name AS p_first, p.last_name AS p_last, p.email AS p_email
    FROM public.spa_appointments sa
    LEFT JOIN public.members m ON m.id = sa.member_id
    LEFT JOIN public.non_member_profiles nmp ON nmp.user_id = sa.user_id AND sa.member_id IS NULL
    LEFT JOIN public.profiles p ON p.user_id = sa.user_id AND sa.member_id IS NULL
    WHERE sa.checked_in_at IS NOT NULL
      AND sa.checked_in_at >= v_today_start
      AND sa.checked_in_at < v_today_end
  LOOP
    IF r.m_first IS NOT NULL OR r.m_last IS NOT NULL THEN
      v_name := NULLIF(btrim(concat_ws(' ', r.m_first, r.m_last)), '');
      v_sub_type := 'Spa Check-in';
    ELSIF r.nmp_first IS NOT NULL OR r.nmp_last IS NOT NULL THEN
      v_name := COALESCE(NULLIF(btrim(concat_ws(' ', r.nmp_first, r.nmp_last)), ''), r.nmp_email);
      v_sub_type := 'Non-Member • Spa Check-in';
    ELSIF r.p_first IS NOT NULL OR r.p_last IS NOT NULL THEN
      v_name := COALESCE(NULLIF(btrim(concat_ws(' ', r.p_first, r.p_last)), ''), r.p_email);
      v_sub_type := 'Non-Member • Spa Check-in';
    ELSE
      v_name := 'Spa Guest';
      v_sub_type := 'Spa Check-in';
    END IF;

    v_spa_count := v_spa_count + 1;
    v_results := v_results || jsonb_build_object(
      'id', 'spa-' || r.id,
      'type', 'spa',
      'name', COALESCE(v_name, 'Spa Guest'),
      'time', r.checked_in_at,
      'subtitle', COALESCE(r.service_name, 'Spa'),
      'sub_type', v_sub_type
    );
  END LOOP;

  SELECT count(*) INTO v_currently_in
  FROM public.check_ins
  WHERE checked_in_at >= v_currently_in_cutoff
    AND checked_out_at IS NULL;

  RETURN jsonb_build_object(
    'entries', v_results,
    'stats', jsonb_build_object(
      'total', v_member_count + v_guest_count + v_class_count + v_spa_count,
      'currently_in', v_currently_in,
      'members', v_member_count,
      'guests', v_guest_count,
      'classes', v_class_count,
      'spa', v_spa_count
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.kiosk_todays_attendance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_todays_attendance() TO anon;
GRANT EXECUTE ON FUNCTION public.kiosk_todays_attendance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_todays_attendance() TO service_role;