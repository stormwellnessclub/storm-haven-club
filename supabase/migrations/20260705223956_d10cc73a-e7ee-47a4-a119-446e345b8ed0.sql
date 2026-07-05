-- Kiosk check-in identity fallback: resolve real names for non-members and
-- expose a sub_type badge (Non-Member / Class Pass / Guest Pass / Walk-In / Spa Guest)
-- for class + spa entries. Members and guest-pass rows keep their existing behavior.

CREATE OR REPLACE FUNCTION public.kiosk_todays_attendance()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_results jsonb := '[]'::jsonb;
  v_today_start timestamptz := (date_trunc('day', (now() AT TIME ZONE 'America/Chicago')) AT TIME ZONE 'America/Chicago');
  v_today_end   timestamptz := v_today_start + interval '1 day';
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
  -- Member check-ins
  FOR r IN
    SELECT ci.id, ci.checked_in_at, m.first_name, m.last_name, m.membership_type, m.photo_url
    FROM public.check_ins ci
    JOIN public.members m ON m.id = ci.member_id
    WHERE ci.checked_in_at >= v_today_start
      AND ci.checked_in_at <  v_today_end
    ORDER BY ci.checked_in_at DESC
  LOOP
    v_member_count := v_member_count + 1;
    v_results := v_results || jsonb_build_object(
      'id', 'member-' || r.id,
      'type', 'member',
      'name', r.first_name || ' ' || r.last_name,
      'time', r.checked_in_at,
      'subtitle', r.membership_type,
      'photo_url', r.photo_url
    );
  END LOOP;

  -- Guest passes used today
  FOR r IN
    SELECT id, guest_name, used_at
    FROM public.guest_passes
    WHERE status = 'used'
      AND used_at >= v_today_start
      AND used_at <  v_today_end
  LOOP
    v_guest_count := v_guest_count + 1;
    v_results := v_results || jsonb_build_object(
      'id', 'guest-' || r.id,
      'type', 'guest',
      'name', r.guest_name,
      'time', r.used_at,
      'subtitle', 'Guest Pass',
      'sub_type', 'Guest Pass'
    );
  END LOOP;

  -- Class bookings checked in today — full identity fallback
  FOR r IN
    SELECT cb.id, cb.checked_in_at, cb.walk_in_name, cb.user_id, cb.pass_id, cb.payment_method,
           m.first_name AS m_first, m.last_name AS m_last,
           nmp.first_name AS nmp_first, nmp.last_name AS nmp_last,
           p.first_name AS p_first, p.last_name AS p_last,
           ct.name AS class_name
    FROM public.class_bookings cb
    JOIN public.class_sessions cs ON cs.id = cb.session_id
    LEFT JOIN public.class_types ct ON ct.id = cs.class_type_id
    LEFT JOIN public.members m ON m.id = cb.member_id
    LEFT JOIN public.non_member_profiles nmp ON nmp.user_id = cb.user_id AND cb.member_id IS NULL
    LEFT JOIN public.profiles p ON p.user_id = cb.user_id AND cb.member_id IS NULL AND nmp.user_id IS NULL
    WHERE cb.checked_in_at >= v_today_start
      AND cb.checked_in_at <  v_today_end
  LOOP
    v_class_count := v_class_count + 1;

    IF r.m_first IS NOT NULL THEN
      v_name := trim(coalesce(r.m_first, '') || ' ' || coalesce(r.m_last, ''));
      v_sub_type := NULL; -- member, no extra badge
    ELSIF r.nmp_first IS NOT NULL OR r.nmp_last IS NOT NULL THEN
      v_name := nullif(trim(coalesce(r.nmp_first, '') || ' ' || coalesce(r.nmp_last, '')), '');
      v_sub_type := CASE WHEN r.pass_id IS NOT NULL THEN 'Class Pass' ELSE 'Non-Member' END;
    ELSIF r.p_first IS NOT NULL OR r.p_last IS NOT NULL THEN
      v_name := nullif(trim(coalesce(r.p_first, '') || ' ' || coalesce(r.p_last, '')), '');
      v_sub_type := CASE WHEN r.pass_id IS NOT NULL THEN 'Class Pass' ELSE 'Non-Member' END;
    ELSIF r.walk_in_name IS NOT NULL THEN
      v_name := r.walk_in_name;
      v_sub_type := CASE WHEN r.payment_method = 'guest_pass' THEN 'Guest Pass' ELSE 'Walk-In' END;
    ELSE
      v_name := 'Unknown';
      v_sub_type := 'Walk-In';
    END IF;

    v_results := v_results || jsonb_build_object(
      'id', 'class-' || r.id,
      'type', 'class',
      'name', coalesce(v_name, 'Unknown'),
      'time', r.checked_in_at,
      'subtitle', coalesce(r.class_name, 'Class'),
      'sub_type', v_sub_type
    );
  END LOOP;

  -- Spa checked in today — full identity fallback
  FOR r IN
    SELECT sa.id, sa.checked_in_at, sa.service_name, sa.user_id,
           m.first_name AS m_first, m.last_name AS m_last,
           nmp.first_name AS nmp_first, nmp.last_name AS nmp_last,
           p.first_name AS p_first, p.last_name AS p_last
    FROM public.spa_appointments sa
    LEFT JOIN public.members m ON m.id = sa.member_id
    LEFT JOIN public.non_member_profiles nmp ON nmp.user_id = sa.user_id AND sa.member_id IS NULL
    LEFT JOIN public.profiles p ON p.user_id = sa.user_id AND sa.member_id IS NULL AND nmp.user_id IS NULL
    WHERE sa.checked_in_at >= v_today_start
      AND sa.checked_in_at <  v_today_end
  LOOP
    v_spa_count := v_spa_count + 1;

    IF r.m_first IS NOT NULL THEN
      v_name := trim(coalesce(r.m_first, '') || ' ' || coalesce(r.m_last, ''));
      v_sub_type := NULL;
    ELSIF r.nmp_first IS NOT NULL OR r.nmp_last IS NOT NULL THEN
      v_name := nullif(trim(coalesce(r.nmp_first, '') || ' ' || coalesce(r.nmp_last, '')), '');
      v_sub_type := 'Spa Guest';
    ELSIF r.p_first IS NOT NULL OR r.p_last IS NOT NULL THEN
      v_name := nullif(trim(coalesce(r.p_first, '') || ' ' || coalesce(r.p_last, '')), '');
      v_sub_type := 'Spa Guest';
    ELSE
      v_name := 'Unknown';
      v_sub_type := 'Spa Guest';
    END IF;

    v_results := v_results || jsonb_build_object(
      'id', 'spa-' || r.id,
      'type', 'spa',
      'name', coalesce(v_name, 'Unknown'),
      'time', r.checked_in_at,
      'subtitle', coalesce(r.service_name, 'Spa'),
      'sub_type', v_sub_type
    );
  END LOOP;

  -- Currently in
  SELECT count(*) INTO v_currently_in
  FROM public.check_ins
  WHERE checked_in_at >= GREATEST(v_today_start, v_currently_in_cutoff)
    AND checked_in_at <  v_today_end
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
$function$;

CREATE OR REPLACE FUNCTION public.kiosk_search_visitors(p_query text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_results jsonb := '[]'::jsonb;
  v_today date := current_date;
  r record;
  v_name text;
  v_sub_type text;
BEGIN
  -- Members
  FOR r IN
    SELECT id, first_name, last_name, membership_type, photo_url, status, member_id
    FROM public.members
    WHERE first_name ILIKE '%' || p_query || '%'
       OR last_name ILIKE '%' || p_query || '%'
       OR member_id ILIKE '%' || p_query || '%'
       OR email ILIKE '%' || p_query || '%'
       OR phone ILIKE '%' || p_query || '%'
    LIMIT 10
  LOOP
    v_results := v_results || jsonb_build_object(
      'id', 'member-' || r.id,
      'type', 'member',
      'name', r.first_name || ' ' || r.last_name,
      'subtitle', r.membership_type,
      'photo_url', r.photo_url,
      'status', r.status,
      'member_uuid', r.id,
      'member_id_text', r.member_id
    );
  END LOOP;

  -- Guest passes
  FOR r IN
    SELECT id, guest_name, guest_email
    FROM public.guest_passes
    WHERE status IN ('active', 'purchased')
      AND (valid_date IS NULL OR valid_date >= v_today)
      AND (guest_name ILIKE '%' || p_query || '%' OR guest_email ILIKE '%' || p_query || '%')
    LIMIT 10
  LOOP
    v_results := v_results || jsonb_build_object(
      'id', 'guest-' || r.id,
      'type', 'guest_pass',
      'name', r.guest_name,
      'subtitle', COALESCE(r.guest_email, 'Guest Pass'),
      'guest_pass_id', r.id,
      'sub_type', 'Guest Pass'
    );
  END LOOP;

  -- Class bookings (today, confirmed, not yet checked-in) with identity fallback
  FOR r IN
    SELECT cb.id, cb.walk_in_name, cb.pass_id, cb.payment_method,
           m.first_name AS m_first, m.last_name AS m_last,
           nmp.first_name AS nmp_first, nmp.last_name AS nmp_last,
           p.first_name AS p_first, p.last_name AS p_last,
           ct.name AS class_name,
           cs.start_time
    FROM public.class_bookings cb
    JOIN public.class_sessions cs ON cs.id = cb.session_id
    LEFT JOIN public.class_types ct ON ct.id = cs.class_type_id
    LEFT JOIN public.members m ON m.id = cb.member_id
    LEFT JOIN public.non_member_profiles nmp ON nmp.user_id = cb.user_id AND cb.member_id IS NULL
    LEFT JOIN public.profiles p ON p.user_id = cb.user_id AND cb.member_id IS NULL AND nmp.user_id IS NULL
    WHERE cs.session_date = v_today
      AND cb.status = 'confirmed'
      AND cb.checked_in_at IS NULL
      AND (
        (m.first_name || ' ' || m.last_name) ILIKE '%' || p_query || '%'
        OR (nmp.first_name || ' ' || nmp.last_name) ILIKE '%' || p_query || '%'
        OR (p.first_name || ' ' || p.last_name) ILIKE '%' || p_query || '%'
        OR cb.walk_in_name ILIKE '%' || p_query || '%'
      )
    LIMIT 10
  LOOP
    IF r.m_first IS NOT NULL THEN
      v_name := trim(coalesce(r.m_first, '') || ' ' || coalesce(r.m_last, ''));
      v_sub_type := NULL;
    ELSIF r.nmp_first IS NOT NULL OR r.nmp_last IS NOT NULL THEN
      v_name := nullif(trim(coalesce(r.nmp_first, '') || ' ' || coalesce(r.nmp_last, '')), '');
      v_sub_type := CASE WHEN r.pass_id IS NOT NULL THEN 'Class Pass' ELSE 'Non-Member' END;
    ELSIF r.p_first IS NOT NULL OR r.p_last IS NOT NULL THEN
      v_name := nullif(trim(coalesce(r.p_first, '') || ' ' || coalesce(r.p_last, '')), '');
      v_sub_type := CASE WHEN r.pass_id IS NOT NULL THEN 'Class Pass' ELSE 'Non-Member' END;
    ELSIF r.walk_in_name IS NOT NULL THEN
      v_name := r.walk_in_name;
      v_sub_type := CASE WHEN r.payment_method = 'guest_pass' THEN 'Guest Pass' ELSE 'Walk-In' END;
    ELSE
      v_name := 'Unknown';
      v_sub_type := 'Walk-In';
    END IF;

    v_results := v_results || jsonb_build_object(
      'id', 'class-' || r.id,
      'type', 'class_booking',
      'name', coalesce(v_name, 'Unknown'),
      'subtitle', COALESCE(r.class_name, 'Class') || ' • ' || COALESCE(left(r.start_time::text, 5), ''),
      'booking_id', r.id,
      'sub_type', v_sub_type
    );
  END LOOP;

  -- Spa appointments with identity fallback
  FOR r IN
    SELECT sa.id, sa.service_name, sa.appointment_time,
           m.first_name AS m_first, m.last_name AS m_last,
           nmp.first_name AS nmp_first, nmp.last_name AS nmp_last,
           p.first_name AS p_first, p.last_name AS p_last
    FROM public.spa_appointments sa
    LEFT JOIN public.members m ON m.id = sa.member_id
    LEFT JOIN public.non_member_profiles nmp ON nmp.user_id = sa.user_id AND sa.member_id IS NULL
    LEFT JOIN public.profiles p ON p.user_id = sa.user_id AND sa.member_id IS NULL AND nmp.user_id IS NULL
    WHERE sa.appointment_date = v_today
      AND sa.status IN ('confirmed', 'pending')
      AND sa.checked_in_at IS NULL
      AND (
        (m.first_name || ' ' || m.last_name) ILIKE '%' || p_query || '%'
        OR (nmp.first_name || ' ' || nmp.last_name) ILIKE '%' || p_query || '%'
        OR (p.first_name || ' ' || p.last_name) ILIKE '%' || p_query || '%'
      )
    LIMIT 10
  LOOP
    IF r.m_first IS NOT NULL THEN
      v_name := trim(coalesce(r.m_first, '') || ' ' || coalesce(r.m_last, ''));
      v_sub_type := NULL;
    ELSIF r.nmp_first IS NOT NULL OR r.nmp_last IS NOT NULL THEN
      v_name := nullif(trim(coalesce(r.nmp_first, '') || ' ' || coalesce(r.nmp_last, '')), '');
      v_sub_type := 'Spa Guest';
    ELSIF r.p_first IS NOT NULL OR r.p_last IS NOT NULL THEN
      v_name := nullif(trim(coalesce(r.p_first, '') || ' ' || coalesce(r.p_last, '')), '');
      v_sub_type := 'Spa Guest';
    ELSE
      v_name := 'Unknown';
      v_sub_type := 'Spa Guest';
    END IF;

    v_results := v_results || jsonb_build_object(
      'id', 'spa-' || r.id,
      'type', 'spa_appointment',
      'name', coalesce(v_name, 'Unknown'),
      'subtitle', COALESCE(r.service_name, 'Spa') || ' • ' || COALESCE(left(r.appointment_time::text, 5), ''),
      'spa_id', r.id,
      'sub_type', v_sub_type
    );
  END LOOP;

  RETURN v_results;
END;
$function$;