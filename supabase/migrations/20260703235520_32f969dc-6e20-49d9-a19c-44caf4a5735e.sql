
CREATE OR REPLACE FUNCTION public.move_class_booking(
  p_booking_id uuid,
  p_target_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_booking record;
  v_source_session record;
  v_target_session record;
  v_target_confirmed int;
  v_source_new_count int;
  v_target_new_count int;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_any_role(v_actor, ARRAY['super_admin','admin','manager','front_desk']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_booking FROM public.class_bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.status <> 'confirmed'::booking_status THEN
    RAISE EXCEPTION 'Only confirmed bookings can be moved (current status: %)', v_booking.status;
  END IF;

  IF v_booking.session_id = p_target_session_id THEN
    RAISE EXCEPTION 'Booking is already on that session';
  END IF;

  SELECT * INTO v_source_session FROM public.class_sessions WHERE id = v_booking.session_id FOR UPDATE;
  SELECT * INTO v_target_session FROM public.class_sessions WHERE id = p_target_session_id FOR UPDATE;

  IF v_target_session.id IS NULL THEN
    RAISE EXCEPTION 'Target session not found';
  END IF;

  IF COALESCE(v_target_session.is_cancelled, false) THEN
    RAISE EXCEPTION 'Target session is cancelled';
  END IF;

  IF (v_target_session.session_date + v_target_session.start_time) < now() AT TIME ZONE 'America/Chicago' - interval '1 hour' THEN
    RAISE EXCEPTION 'Target session is in the past';
  END IF;

  -- Prevent duplicate booking (same user already on target session)
  IF v_booking.user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.class_bookings
    WHERE session_id = p_target_session_id
      AND user_id = v_booking.user_id
      AND status = 'confirmed'::booking_status
      AND id <> p_booking_id
  ) THEN
    RAISE EXCEPTION 'This member is already booked on the target session';
  END IF;

  -- Capacity check on target
  SELECT COUNT(*) INTO v_target_confirmed
  FROM public.class_bookings
  WHERE session_id = p_target_session_id
    AND status = 'confirmed'::booking_status;

  IF v_target_confirmed >= v_target_session.max_capacity THEN
    RAISE EXCEPTION 'Target session is full';
  END IF;

  -- Move the booking (credit/pass stays attached)
  UPDATE public.class_bookings
     SET session_id = p_target_session_id,
         updated_at = now()
   WHERE id = p_booking_id;

  -- Recompute enrollment for both sessions
  SELECT COUNT(*) INTO v_source_new_count
    FROM public.class_bookings
   WHERE session_id = v_source_session.id AND status = 'confirmed'::booking_status;

  SELECT COUNT(*) INTO v_target_new_count
    FROM public.class_bookings
   WHERE session_id = p_target_session_id AND status = 'confirmed'::booking_status;

  UPDATE public.class_sessions SET current_enrollment = v_source_new_count, updated_at = now() WHERE id = v_source_session.id;
  UPDATE public.class_sessions SET current_enrollment = v_target_new_count, updated_at = now() WHERE id = p_target_session_id;

  -- Audit log (best effort)
  BEGIN
    INSERT INTO public.admin_action_log (member_id, action_type, action_data, performed_by, can_undo)
    VALUES (
      v_booking.member_id,
      'moved_class_booking',
      jsonb_build_object(
        'booking_id', p_booking_id,
        'from_session_id', v_source_session.id,
        'to_session_id', p_target_session_id,
        'from_date', v_source_session.session_date,
        'from_start_time', v_source_session.start_time,
        'to_date', v_target_session.session_date,
        'to_start_time', v_target_session.start_time
      ),
      v_actor,
      false
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'from_session_id', v_source_session.id,
    'to_session_id', p_target_session_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.move_class_booking(uuid, uuid) TO authenticated;
