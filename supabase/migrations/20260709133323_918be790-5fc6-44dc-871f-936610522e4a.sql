
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
  v_block_reason text;
  v_has_arrears boolean;
BEGIN
  -- Members
  FOR r IN
    SELECT id, first_name, last_name, membership_type, photo_url, status, member_id,
           subscription_status, payment_past_due, billing_type
    FROM public.members
    WHERE first_name ILIKE '%' || p_query || '%'
       OR last_name ILIKE '%' || p_query || '%'
       OR member_id ILIKE '%' || p_query || '%'
       OR email ILIKE '%' || p_query || '%'
       OR phone ILIKE '%' || p_query || '%'
    LIMIT 10
  LOOP
    -- Compute billing block reason (mirrors evaluate_member_check_in_eligibility)
    v_block_reason := NULL;

    SELECT EXISTS (
      SELECT 1 FROM public.billing_arrears ba
      WHERE ba.member_id = r.id
        AND ba.status IN ('unpaid', 'partial')
        AND COALESCE(ba.amount_due_cents, 0) > COALESCE(ba.amount_paid_cents, 0)
    ) INTO v_has_arrears;

    IF r.payment_past_due IS TRUE THEN
      v_block_reason := 'payment_past_due';
    ELSIF v_has_arrears THEN
      v_block_reason := 'unpaid_dues';
    ELSIF COALESCE(r.billing_type, '') <> 'cash' AND r.subscription_status IN ('past_due','unpaid','canceled','incomplete_expired') THEN
      v_block_reason := 'subscription_' || r.subscription_status;
    END IF;

    v_results := v_results || jsonb_build_object(
      'id', 'member-' || r.id,
      'type', 'member',
      'name', r.first_name || ' ' || r.last_name,
      'subtitle', r.membership_type,
      'photo_url', r.photo_url,
      'status', r.status,
      'member_uuid', r.id,
      'member_id_text', r.member_id,
      'subscription_status', r.subscription_status,
      'payment_past_due', COALESCE(r.payment_past_due, false),
      'has_unpaid_arrears', v_has_arrears,
      'billing_block_reason', v_block_reason
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
