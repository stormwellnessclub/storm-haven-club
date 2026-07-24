
CREATE OR REPLACE FUNCTION public.delete_class_type(_class_type_id uuid, _force boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _name text;
  _upcoming_bookings int;
  _total_bookings int;
  _schedules int;
  _future_sessions int;
BEGIN
  IF _uid IS NULL OR NOT (public.has_role(_uid, 'admin') OR public.has_role(_uid, 'super_admin')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT name INTO _name FROM public.class_types WHERE id = _class_type_id;
  IF _name IS NULL THEN
    RAISE EXCEPTION 'Class type not found';
  END IF;

  SELECT COUNT(*) INTO _schedules FROM public.class_schedules WHERE class_type_id = _class_type_id;

  SELECT COUNT(*) INTO _upcoming_bookings
  FROM public.class_bookings b
  JOIN public.class_sessions s ON s.id = b.session_id
  WHERE s.class_type_id = _class_type_id
    AND s.session_date >= CURRENT_DATE
    AND COALESCE(b.status, 'confirmed') IN ('confirmed','checked_in','pending');

  SELECT COUNT(*) INTO _total_bookings
  FROM public.class_bookings b
  JOIN public.class_sessions s ON s.id = b.session_id
  WHERE s.class_type_id = _class_type_id;

  IF _upcoming_bookings > 0 THEN
    RETURN jsonb_build_object(
      'status','blocked',
      'reason','upcoming_bookings',
      'upcoming_bookings', _upcoming_bookings,
      'message', 'Cannot delete — ' || _upcoming_bookings || ' upcoming booking(s) exist. Cancel those sessions first.'
    );
  END IF;

  -- If historical bookings exist and not forced, refuse hard delete to preserve history.
  IF _total_bookings > 0 AND NOT _force THEN
    UPDATE public.class_types SET is_active = false, updated_at = now() WHERE id = _class_type_id;
    RETURN jsonb_build_object(
      'status','deactivated',
      'reason','historical_bookings',
      'total_bookings', _total_bookings,
      'message', 'Class type deactivated instead of deleted — ' || _total_bookings || ' historical booking(s) preserved.'
    );
  END IF;

  -- Delete future empty sessions explicitly (they cascade anyway, but returned in summary)
  SELECT COUNT(*) INTO _future_sessions
  FROM public.class_sessions
  WHERE class_type_id = _class_type_id AND session_date >= CURRENT_DATE;

  DELETE FROM public.class_types WHERE id = _class_type_id;

  RETURN jsonb_build_object(
    'status','deleted',
    'name', _name,
    'schedules_removed', _schedules,
    'future_sessions_removed', _future_sessions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_class_type(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_class_type(uuid, boolean) TO authenticated;
