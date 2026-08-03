CREATE OR REPLACE FUNCTION public.pt_check_appointment_conflict(
  p_starts_at timestamp with time zone,
  p_ends_at timestamp with time zone,
  p_instructor_id uuid DEFAULT NULL::uuid,
  p_location_id uuid DEFAULT NULL::uuid,
  p_exclude_id uuid DEFAULT NULL::uuid,
  p_format pt_format DEFAULT NULL::pt_format
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trainer jsonb := '[]'::jsonb;
  v_room jsonb := '[]'::jsonb;
  v_group_count integer := 0;
  v_capacity integer := 1;
  v_is_group boolean := (p_format = 'semi_private'::pt_format);
  v_group_full boolean := false;
BEGIN
  IF NOT public.pt_is_staff_or_desk(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_is_group THEN
    SELECT GREATEST(COALESCE(MAX(st.capacity), 1), 1) INTO v_capacity
    FROM pt_session_types st
    WHERE st.format = p_format AND st.is_active = true;

    -- how many people are already in this exact group slot
    SELECT count(*) INTO v_group_count
    FROM pt_appointments a
    WHERE a.format = p_format
      AND a.starts_at = p_starts_at
      AND a.ends_at = p_ends_at
      AND a.instructor_id IS NOT DISTINCT FROM p_instructor_id
      AND a.status NOT IN ('cancelled','late_cancel','no_show')
      AND coalesce(a.is_waitlist, false) = false
      AND (p_exclude_id IS NULL OR a.id <> p_exclude_id);

    v_group_full := v_group_count >= v_capacity;
  END IF;

  IF p_instructor_id IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'user_id', a.user_id)), '[]'::jsonb)
      INTO v_trainer
    FROM pt_appointments a
    WHERE a.instructor_id = p_instructor_id
      AND a.status NOT IN ('cancelled','late_cancel','no_show')
      AND coalesce(a.is_waitlist, false) = false
      AND (p_exclude_id IS NULL OR a.id <> p_exclude_id)
      AND a.starts_at < p_ends_at
      AND a.ends_at > p_starts_at
      -- same-group members are not conflicts while the group has room
      AND NOT (
        v_is_group
        AND NOT v_group_full
        AND a.format = p_format
        AND a.starts_at = p_starts_at
        AND a.ends_at = p_ends_at
      );
  END IF;

  IF p_location_id IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'user_id', a.user_id)), '[]'::jsonb)
      INTO v_room
    FROM pt_appointments a
    WHERE a.location_id = p_location_id
      AND a.status NOT IN ('cancelled','late_cancel','no_show')
      AND coalesce(a.is_waitlist, false) = false
      AND (p_exclude_id IS NULL OR a.id <> p_exclude_id)
      AND a.starts_at < p_ends_at
      AND a.ends_at > p_starts_at
      AND NOT (
        v_is_group
        AND NOT v_group_full
        AND a.format = p_format
        AND a.starts_at = p_starts_at
        AND a.ends_at = p_ends_at
        AND a.instructor_id IS NOT DISTINCT FROM p_instructor_id
      );
  END IF;

  RETURN jsonb_build_object(
    'has_conflict', (jsonb_array_length(v_trainer) > 0 OR jsonb_array_length(v_room) > 0),
    'trainer_conflicts', v_trainer,
    'room_conflicts', v_room,
    'is_group', COALESCE(v_is_group, false),
    'group_count', v_group_count,
    'group_capacity', v_capacity,
    'group_full', v_group_full
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.pt_check_appointment_conflict(timestamptz, timestamptz, uuid, uuid, uuid, pt_format) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_check_appointment_conflict(timestamptz, timestamptz, uuid, uuid, uuid, pt_format) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pt_group_slot_occupancy(
  p_starts_at timestamp with time zone,
  p_ends_at timestamp with time zone,
  p_instructor_id uuid DEFAULT NULL::uuid,
  p_format pt_format DEFAULT 'semi_private'::pt_format
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_capacity integer := 1;
  v_names jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.pt_is_staff_or_desk(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT GREATEST(COALESCE(MAX(st.capacity), 1), 1) INTO v_capacity
  FROM pt_session_types st
  WHERE st.format = p_format AND st.is_active = true;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'appointment_id', a.id,
    'user_id', a.user_id,
    'name', COALESCE(
      NULLIF(TRIM(CONCAT(m.first_name, ' ', m.last_name)), ''),
      NULLIF(TRIM(CONCAT(nm.first_name, ' ', nm.last_name)), ''),
      p.full_name,
      p.email,
      'Client'
    )
  ) ORDER BY a.created_at), '[]'::jsonb)
  INTO v_names
  FROM pt_appointments a
  LEFT JOIN members m ON m.user_id = a.user_id
  LEFT JOIN non_member_profiles nm ON nm.user_id = a.user_id
  LEFT JOIN profiles p ON p.user_id = a.user_id
  WHERE a.format = p_format
    AND a.starts_at = p_starts_at
    AND a.ends_at = p_ends_at
    AND a.instructor_id IS NOT DISTINCT FROM p_instructor_id
    AND a.status NOT IN ('cancelled','late_cancel','no_show')
    AND coalesce(a.is_waitlist, false) = false;

  RETURN jsonb_build_object(
    'capacity', v_capacity,
    'booked', jsonb_array_length(v_names),
    'attendees', v_names
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.pt_group_slot_occupancy(timestamptz, timestamptz, uuid, pt_format) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_group_slot_occupancy(timestamptz, timestamptz, uuid, pt_format) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.book_pt_appointment(p_user_id uuid, p_format pt_format, p_starts_at timestamp with time zone, p_duration_minutes integer DEFAULT 60, p_instructor_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text, p_pass_id uuid DEFAULT NULL::uuid, p_unpaid boolean DEFAULT false, p_rate_cents integer DEFAULT 0, p_location_id uuid DEFAULT NULL::uuid, p_force boolean DEFAULT false)
 RETURNS pt_appointments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pass public.pt_passes;
  v_usage public.pt_session_usage;
  v_appt public.pt_appointments;
  v_admin uuid := auth.uid();
  v_is_staff boolean := has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role,'front_desk'::app_role]);
  v_ends_at timestamptz := p_starts_at + (p_duration_minutes || ' minutes')::interval;
  v_conflict jsonb;
BEGIN
  IF NOT v_is_staff AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized to book for this user';
  END IF;

  -- prevent booking the same person twice into the same slot
  IF EXISTS (
    SELECT 1 FROM public.pt_appointments a
    WHERE a.user_id = p_user_id
      AND a.starts_at = p_starts_at
      AND a.ends_at = v_ends_at
      AND a.status NOT IN ('cancelled','late_cancel','no_show')
  ) THEN
    RAISE EXCEPTION 'ALREADY_BOOKED: This client is already booked for that time.';
  END IF;

  IF NOT COALESCE(p_force, false) AND (p_instructor_id IS NOT NULL OR p_location_id IS NOT NULL) THEN
    v_conflict := public.pt_check_appointment_conflict(p_starts_at, v_ends_at, p_instructor_id, p_location_id, NULL, p_format);
    IF (v_conflict->>'has_conflict')::boolean THEN
      IF COALESCE((v_conflict->>'group_full')::boolean, false) THEN
        RAISE EXCEPTION 'GROUP_FULL: Semi-private session is full (% of %).',
          v_conflict->>'group_count', v_conflict->>'group_capacity';
      END IF;
      RAISE EXCEPTION 'CONFLICT: %', v_conflict::text;
    END IF;
  END IF;

  IF p_unpaid THEN
    IF NOT v_is_staff THEN
      RAISE EXCEPTION 'Only staff can book an unpaid session';
    END IF;

    INSERT INTO public.pt_appointments (
      user_id, pass_id, usage_id, instructor_id, location_id, format,
      starts_at, ends_at, duration_minutes, notes,
      booked_by_admin_id, payment_status, amount_due_cents
    ) VALUES (
      p_user_id, NULL, NULL, p_instructor_id, p_location_id, p_format,
      p_starts_at, v_ends_at, p_duration_minutes, p_notes,
      v_admin, 'unpaid', GREATEST(COALESCE(p_rate_cents, 0), 0)
    )
    RETURNING * INTO v_appt;

    RETURN v_appt;
  END IF;

  IF p_pass_id IS NOT NULL THEN
    SELECT * INTO v_pass FROM public.pt_passes
     WHERE id = p_pass_id AND user_id = p_user_id
       AND status = 'active' AND sessions_remaining > 0
       AND expires_at >= (now() AT TIME ZONE 'America/Detroit')::date
     FOR UPDATE;
  ELSE
    SELECT * INTO v_pass FROM public.pt_passes
     WHERE user_id = p_user_id AND format = p_format
       AND status = 'active' AND sessions_remaining > 0
       AND expires_at >= (now() AT TIME ZONE 'America/Detroit')::date
     ORDER BY expires_at ASC, created_at ASC
     LIMIT 1
     FOR UPDATE;
  END IF;

  IF v_pass.id IS NULL THEN
    RAISE EXCEPTION 'NO_SESSIONS: This customer has no active % sessions remaining. Sell a pack first.', p_format;
  END IF;

  INSERT INTO public.pt_session_usage (pass_id, used_at, used_by_admin_id, notes)
  VALUES (v_pass.id, p_starts_at, CASE WHEN v_is_staff THEN v_admin END, 'Booked appointment')
  RETURNING * INTO v_usage;

  UPDATE public.pt_passes
     SET sessions_remaining = sessions_remaining - 1,
         status = CASE WHEN sessions_remaining - 1 = 0 THEN 'exhausted'::pt_pass_status ELSE status END,
         updated_at = now()
   WHERE id = v_pass.id;

  INSERT INTO public.pt_appointments (
    user_id, pass_id, usage_id, instructor_id, location_id, format,
    starts_at, ends_at, duration_minutes, notes,
    booked_by_admin_id, payment_status, package_deducted, package_deducted_at
  ) VALUES (
    p_user_id, v_pass.id, v_usage.id, p_instructor_id, p_location_id, p_format,
    p_starts_at, v_ends_at, p_duration_minutes, p_notes,
    CASE WHEN v_is_staff THEN v_admin END, 'pass', true, now()
  )
  RETURNING * INTO v_appt;

  RETURN v_appt;
END;
$function$;