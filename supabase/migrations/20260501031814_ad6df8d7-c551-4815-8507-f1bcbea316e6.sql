-- Normalize check_spa_appointment_conflict to ensure room_id and exclude_appointment_id
-- are honored for both staff and room conflict checks, and to include all
-- "occupying" statuses (confirmed, pending, checked_in, in_progress).
DROP FUNCTION IF EXISTS public.check_spa_appointment_conflict(date, time without time zone, integer, integer, uuid, uuid);
DROP FUNCTION IF EXISTS public.check_spa_appointment_conflict(date, time without time zone, integer, integer, uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.check_spa_appointment_conflict(
  p_appointment_date date,
  p_appointment_time time without time zone,
  p_duration_minutes integer,
  p_cleanup_minutes integer DEFAULT 15,
  p_staff_id uuid DEFAULT NULL,
  p_room_id uuid DEFAULT NULL,
  p_exclude_appointment_id uuid DEFAULT NULL
)
RETURNS TABLE(has_conflict boolean, conflict_type text, conflicting_appointment_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_start timestamp;
  v_new_end timestamp;
  v_conflict_id uuid;
BEGIN
  v_new_start := (p_appointment_date::text || ' ' || p_appointment_time::text)::timestamp;
  v_new_end := v_new_start + ((p_duration_minutes + COALESCE(p_cleanup_minutes, 15)) || ' minutes')::interval;

  -- Therapist conflict
  IF p_staff_id IS NOT NULL THEN
    SELECT a.id INTO v_conflict_id
    FROM spa_appointments a
    WHERE a.appointment_date = p_appointment_date
      AND a.staff_id = p_staff_id
      AND a.status IN ('confirmed', 'pending', 'checked_in', 'in_progress')
      AND (p_exclude_appointment_id IS NULL OR a.id <> p_exclude_appointment_id)
      AND tstzrange(
            (a.appointment_date::text || ' ' || a.appointment_time::text)::timestamp,
            (a.appointment_date::text || ' ' || a.appointment_time::text)::timestamp
              + ((COALESCE(a.duration_minutes, 60) + COALESCE(a.cleanup_minutes, 15)) || ' minutes')::interval,
            '[)'
          ) && tstzrange(v_new_start, v_new_end, '[)')
    LIMIT 1;

    IF v_conflict_id IS NOT NULL THEN
      RETURN QUERY SELECT true, 'staff'::text, v_conflict_id;
      RETURN;
    END IF;
  END IF;

  -- Room conflict
  IF p_room_id IS NOT NULL THEN
    SELECT a.id INTO v_conflict_id
    FROM spa_appointments a
    WHERE a.appointment_date = p_appointment_date
      AND a.room_id = p_room_id
      AND a.status IN ('confirmed', 'pending', 'checked_in', 'in_progress')
      AND (p_exclude_appointment_id IS NULL OR a.id <> p_exclude_appointment_id)
      AND tstzrange(
            (a.appointment_date::text || ' ' || a.appointment_time::text)::timestamp,
            (a.appointment_date::text || ' ' || a.appointment_time::text)::timestamp
              + ((COALESCE(a.duration_minutes, 60) + COALESCE(a.cleanup_minutes, 15)) || ' minutes')::interval,
            '[)'
          ) && tstzrange(v_new_start, v_new_end, '[)')
    LIMIT 1;

    IF v_conflict_id IS NOT NULL THEN
      RETURN QUERY SELECT true, 'room'::text, v_conflict_id;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT false, NULL::text, NULL::uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_spa_appointment_conflict(date, time without time zone, integer, integer, uuid, uuid, uuid) TO authenticated;