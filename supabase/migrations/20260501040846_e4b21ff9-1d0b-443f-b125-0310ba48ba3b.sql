CREATE OR REPLACE FUNCTION public.update_spa_appointment_admin(
  p_appointment_id uuid,
  p_service_id text,
  p_service_name text,
  p_service_category text,
  p_service_price numeric,
  p_member_price numeric,
  p_duration_minutes integer,
  p_cleanup_minutes integer,
  p_appointment_date date,
  p_appointment_time time without time zone,
  p_staff_id uuid,
  p_room_id uuid,
  p_staff_notes text,
  p_override_conflict boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_authorized boolean;
  v_existing record;
  v_conflict record;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT (
    public.has_any_role(v_uid, ARRAY['admin','super_admin','staff','front_desk','manager']::app_role[])
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_existing FROM public.spa_appointments WHERE id = p_appointment_id;
  IF v_existing.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Appointment not found');
  END IF;

  IF NOT p_override_conflict THEN
    SELECT * INTO v_conflict
    FROM public.check_spa_appointment_conflict(
      p_appointment_date,
      p_appointment_time,
      p_duration_minutes,
      COALESCE(p_cleanup_minutes, 15),
      p_staff_id,
      p_room_id,
      p_appointment_id
    );

    IF v_conflict.has_conflict THEN
      RETURN jsonb_build_object(
        'success', false,
        'conflict', true,
        'conflict_type', v_conflict.conflict_type,
        'conflicting_appointment_id', v_conflict.conflicting_appointment_id,
        'error',
          CASE v_conflict.conflict_type
            WHEN 'room' THEN 'This room is already booked at that time.'
            WHEN 'staff' THEN 'This therapist already has a booking at that time.'
            ELSE 'There is a scheduling conflict.'
          END
      );
    END IF;
  END IF;

  UPDATE public.spa_appointments
  SET service_id = p_service_id,
      service_name = p_service_name,
      service_category = p_service_category,
      service_price = p_service_price,
      member_price = p_member_price,
      duration_minutes = p_duration_minutes,
      cleanup_minutes = COALESCE(p_cleanup_minutes, 15),
      appointment_date = p_appointment_date,
      appointment_time = p_appointment_time,
      staff_id = p_staff_id,
      room_id = p_room_id,
      staff_notes = COALESCE(p_staff_notes, staff_notes),
      updated_at = now()
  WHERE id = p_appointment_id;

  RETURN jsonb_build_object('success', true, 'appointment_id', p_appointment_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_spa_appointment_admin(
  uuid, text, text, text, numeric, numeric, integer, integer,
  date, time without time zone, uuid, uuid, text, boolean
) TO authenticated;