
-- 1. Fix kiosk_check_in_guest: set valid_date = current_date on check-in
CREATE OR REPLACE FUNCTION public.kiosk_check_in_guest(p_guest_pass_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_guest record;
BEGIN
  SELECT id, guest_name, status, valid_date
  INTO v_guest
  FROM public.guest_passes
  WHERE id = p_guest_pass_id;

  IF v_guest IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Guest pass not found');
  END IF;

  IF v_guest.status NOT IN ('active', 'purchased') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Guest pass already used or expired');
  END IF;

  UPDATE public.guest_passes
  SET status = 'used', used_at = now(), valid_date = current_date
  WHERE id = p_guest_pass_id;

  RETURN jsonb_build_object('success', true, 'name', v_guest.guest_name);
END;
$function$;

-- 2. Fix kiosk_todays_attendance: filter guests by used_at >= today instead of valid_date
CREATE OR REPLACE FUNCTION public.kiosk_todays_attendance()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_results jsonb := '[]'::jsonb;
  v_today_start timestamptz := date_trunc('day', now());
  v_today date := current_date;
  r record;
  v_currently_in int;
  v_member_count int := 0;
  v_guest_count int := 0;
  v_class_count int := 0;
  v_spa_count int := 0;
BEGIN
  -- Member check-ins
  FOR r IN
    SELECT ci.id, ci.checked_in_at, m.first_name, m.last_name, m.membership_type, m.photo_url
    FROM public.check_ins ci
    JOIN public.members m ON m.id = ci.member_id
    WHERE ci.checked_in_at >= v_today_start
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

  -- Guest passes used today (filter by used_at instead of valid_date)
  FOR r IN
    SELECT id, guest_name, used_at
    FROM public.guest_passes
    WHERE status = 'used' AND used_at >= v_today_start
  LOOP
    v_guest_count := v_guest_count + 1;
    v_results := v_results || jsonb_build_object(
      'id', 'guest-' || r.id,
      'type', 'guest',
      'name', r.guest_name,
      'time', r.used_at,
      'subtitle', 'Guest Pass'
    );
  END LOOP;

  -- Class bookings checked in today
  FOR r IN
    SELECT cb.id, cb.checked_in_at, cb.walk_in_name,
           m.first_name, m.last_name, ct.name as class_name
    FROM public.class_bookings cb
    JOIN public.class_sessions cs ON cs.id = cb.session_id
    LEFT JOIN public.class_types ct ON ct.id = cs.class_type_id
    LEFT JOIN public.members m ON m.id = cb.member_id
    WHERE cb.checked_in_at >= v_today_start
  LOOP
    v_class_count := v_class_count + 1;
    v_results := v_results || jsonb_build_object(
      'id', 'class-' || r.id,
      'type', 'class',
      'name', COALESCE(r.first_name || ' ' || r.last_name, r.walk_in_name, 'Walk-in'),
      'time', r.checked_in_at,
      'subtitle', COALESCE(r.class_name, 'Class')
    );
  END LOOP;

  -- Spa checked in today
  FOR r IN
    SELECT sa.id, sa.checked_in_at, sa.service_name,
           m.first_name, m.last_name
    FROM public.spa_appointments sa
    LEFT JOIN public.members m ON m.id = sa.member_id
    WHERE sa.checked_in_at >= v_today_start
  LOOP
    v_spa_count := v_spa_count + 1;
    v_results := v_results || jsonb_build_object(
      'id', 'spa-' || r.id,
      'type', 'spa',
      'name', COALESCE(r.first_name || ' ' || r.last_name, 'Unknown'),
      'time', r.checked_in_at,
      'subtitle', COALESCE(r.service_name, 'Spa')
    );
  END LOOP;

  -- Currently in count
  SELECT count(*) INTO v_currently_in
  FROM public.check_ins
  WHERE checked_in_at >= v_today_start AND checked_out_at IS NULL;

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

-- 3. Fix kiosk_search_visitors: broaden guest search to include future/null valid_dates
CREATE OR REPLACE FUNCTION public.kiosk_search_visitors(p_query text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_results jsonb := '[]'::jsonb;
  v_today date := current_date;
  v_today_start timestamptz := date_trunc('day', now());
  r record;
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

  -- Guest passes (active/purchased, today or future or null valid_date)
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
      'guest_pass_id', r.id
    );
  END LOOP;

  -- Class bookings (today, confirmed)
  FOR r IN
    SELECT cb.id, cb.walk_in_name,
           m.first_name, m.last_name,
           ct.name as class_name,
           cs.start_time, cs.end_time
    FROM public.class_bookings cb
    JOIN public.class_sessions cs ON cs.id = cb.session_id
    LEFT JOIN public.class_types ct ON ct.id = cs.class_type_id
    LEFT JOIN public.members m ON m.id = cb.member_id
    WHERE cs.session_date = v_today
      AND cb.status = 'confirmed'
      AND cb.checked_in_at IS NULL
      AND (
        (m.first_name || ' ' || m.last_name) ILIKE '%' || p_query || '%'
        OR cb.walk_in_name ILIKE '%' || p_query || '%'
      )
    LIMIT 10
  LOOP
    v_results := v_results || jsonb_build_object(
      'id', 'class-' || r.id,
      'type', 'class_booking',
      'name', COALESCE(r.first_name || ' ' || r.last_name, r.walk_in_name, 'Walk-in'),
      'subtitle', COALESCE(r.class_name, 'Class') || ' • ' || COALESCE(left(r.start_time::text, 5), ''),
      'booking_id', r.id
    );
  END LOOP;

  -- Spa appointments (today, confirmed/pending)
  FOR r IN
    SELECT sa.id, sa.service_name, sa.appointment_time, sa.duration_minutes,
           m.first_name, m.last_name
    FROM public.spa_appointments sa
    LEFT JOIN public.members m ON m.id = sa.member_id
    WHERE sa.appointment_date = v_today
      AND sa.status IN ('confirmed', 'pending')
      AND sa.checked_in_at IS NULL
      AND (m.first_name || ' ' || m.last_name) ILIKE '%' || p_query || '%'
    LIMIT 10
  LOOP
    v_results := v_results || jsonb_build_object(
      'id', 'spa-' || r.id,
      'type', 'spa_appointment',
      'name', r.first_name || ' ' || r.last_name,
      'subtitle', COALESCE(r.service_name, 'Spa') || ' • ' || COALESCE(left(r.appointment_time::text, 5), ''),
      'spa_id', r.id
    );
  END LOOP;

  RETURN v_results;
END;
$function$;
