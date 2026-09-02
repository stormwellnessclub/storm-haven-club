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
      NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''),
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