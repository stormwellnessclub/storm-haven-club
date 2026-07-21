
-- Modify only the member section by wrapping the existing function.
-- Recreate the function with the additional is_first_visit flag on member entries.
CREATE OR REPLACE FUNCTION public.kiosk_todays_attendance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_results jsonb := '[]'::jsonb;
  v_today_start timestamptz := (date_trunc('day', (now() AT TIME ZONE 'America/Detroit')) AT TIME ZONE 'America/Detroit');
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
  -- Member check-ins (with first-visit flag)
  FOR r IN
    SELECT ci.id, ci.checked_in_at, ci.notes, m.first_name, m.last_name, m.membership_type, m.photo_url
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
      'photo_url', r.photo_url,
      'is_first_visit', COALESCE(r.notes ILIKE 'First club visit%', false)
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

  -- Class bookings checked in today
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
      v_name := r.m_first || ' ' || r.m_last;
      v_sub_type := NULL;
    ELSIF r.nmp_first IS NOT NULL THEN
      v_name := r.nmp_first || ' ' || r.nmp_last;
      v_sub_type := 'Non-Member';
    ELSIF r.p_first IS NOT NULL THEN
      v_name := r.p_first || ' ' || r.p_last;
      v_sub_type := 'Non-Member';
    ELSIF r.walk_in_name IS NOT NULL THEN
      v_name := r.walk_in_name;
      v_sub_type := CASE WHEN r.pass_id IS NOT NULL THEN 'Guest Pass' ELSE 'Walk-in' END;
    ELSE
      v_name := 'Walk-in';
      v_sub_type := 'Walk-in';
    END IF;

    v_results := v_results || jsonb_build_object(
      'id', 'class-' || r.id,
      'type', 'class',
      'name', v_name,
      'time', r.checked_in_at,
      'subtitle', COALESCE(r.class_name, 'Class'),
      'sub_type', v_sub_type
    );
  END LOOP;

  -- Spa appointments checked in today
  FOR r IN
    SELECT sa.id, sa.checked_in_at, sa.customer_first_name, sa.customer_last_name,
           sa.customer_email, sa.customer_user_id,
           ss.name AS service_name,
           m.first_name AS m_first, m.last_name AS m_last,
           nmp.first_name AS nmp_first, nmp.last_name AS nmp_last
    FROM public.spa_appointments sa
    LEFT JOIN public.spa_services ss ON ss.id = sa.service_id
    LEFT JOIN public.members m ON m.email ILIKE sa.customer_email
    LEFT JOIN public.non_member_profiles nmp ON nmp.user_id = sa.customer_user_id
    WHERE sa.checked_in_at >= v_today_start
      AND sa.checked_in_at <  v_today_end
  LOOP
    v_spa_count := v_spa_count + 1;

    IF r.m_first IS NOT NULL THEN
      v_name := r.m_first || ' ' || r.m_last;
      v_sub_type := NULL;
    ELSIF r.nmp_first IS NOT NULL THEN
      v_name := r.nmp_first || ' ' || r.nmp_last;
      v_sub_type := 'Non-Member';
    ELSE
      v_name := COALESCE(NULLIF(TRIM(COALESCE(r.customer_first_name,'') || ' ' || COALESCE(r.customer_last_name,'')), ''), 'Spa Guest');
      v_sub_type := 'Guest';
    END IF;

    v_results := v_results || jsonb_build_object(
      'id', 'spa-' || r.id,
      'type', 'spa',
      'name', v_name,
      'time', r.checked_in_at,
      'subtitle', COALESCE(r.service_name, 'Spa'),
      'sub_type', v_sub_type
    );
  END LOOP;

  SELECT COUNT(*) INTO v_currently_in
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
$function$;
