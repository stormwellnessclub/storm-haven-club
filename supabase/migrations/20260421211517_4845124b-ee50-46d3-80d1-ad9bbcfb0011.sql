CREATE OR REPLACE FUNCTION public.kiosk_todays_attendance()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_results jsonb := '[]'::jsonb;
  -- America/Chicago day window expressed as UTC timestamptz
  v_today_start timestamptz := (date_trunc('day', (now() AT TIME ZONE 'America/Chicago')) AT TIME ZONE 'America/Chicago');
  v_today_end   timestamptz := v_today_start + interval '1 day';
  -- 12-hour cutoff for "currently in" to prevent stale check-ins from inflating count
  v_currently_in_cutoff timestamptz := now() - interval '12 hours';
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
      AND cb.checked_in_at <  v_today_end
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
      AND sa.checked_in_at <  v_today_end
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

  -- Currently in: today's check-ins still open, capped at 12-hour cutoff
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