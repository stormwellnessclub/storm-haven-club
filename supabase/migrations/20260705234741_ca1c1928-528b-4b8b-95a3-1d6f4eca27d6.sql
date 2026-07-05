CREATE OR REPLACE FUNCTION public.cancel_class_booking(_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _booking RECORD;
  _session RECORD;
  _class_type RECORD;
  _instructor RECORD;
  _session_datetime timestamptz;
  _hours_until_class double precision;
  _forfeit_credit boolean := false;
  _cancellation_reason text;
BEGIN
  SELECT * INTO _booking FROM class_bookings
  WHERE id = _booking_id AND user_id = auth.uid() AND status = 'confirmed'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found or already cancelled');
  END IF;

  SELECT * INTO _session FROM class_sessions WHERE id = _booking.session_id;
  SELECT * INTO _class_type FROM class_types WHERE id = _session.class_type_id;
  SELECT * INTO _instructor FROM instructors WHERE id = _session.instructor_id;

  _session_datetime := ((_session.session_date || ' ' || _session.start_time)::timestamp AT TIME ZONE 'America/Chicago');
  _hours_until_class := EXTRACT(EPOCH FROM (_session_datetime - now())) / 3600.0;

  IF _hours_until_class < 24 THEN
    _forfeit_credit := true;
    _cancellation_reason := 'Late cancellation - credit forfeited';
  ELSE
    _cancellation_reason := 'Member cancelled';
  END IF;

  UPDATE class_bookings
  SET status = 'cancelled', cancelled_at = now(), cancellation_reason = _cancellation_reason
  WHERE id = _booking_id;

  IF NOT _forfeit_credit THEN
    IF _booking.member_credit_id IS NOT NULL THEN
      UPDATE member_credits SET credits_remaining = LEAST(credits_remaining + 1, credits_total) WHERE id = _booking.member_credit_id;
    ELSIF _booking.pass_id IS NOT NULL THEN
      UPDATE class_passes
      SET classes_remaining = LEAST(classes_remaining + 1, classes_total),
          status = CASE WHEN status = 'exhausted' THEN 'active'::pass_status ELSE status END
      WHERE id = _booking.pass_id;
    END IF;
  END IF;

  -- Recompute session enrollment so the freed spot immediately reopens on the schedule.
  UPDATE public.class_sessions cs
  SET current_enrollment = (
        SELECT COUNT(*)
        FROM public.class_bookings b
        WHERE b.session_id = cs.id
          AND b.status IN ('confirmed', 'completed')
      ),
      updated_at = now()
  WHERE cs.id = _session.id;

  RETURN jsonb_build_object(
    'success', true,
    'forfeit_credit', _forfeit_credit,
    'session_id', _session.id,
    'session_date', _session.session_date,
    'start_time', _session.start_time,
    'room', _session.room,
    'class_name', _class_type.name,
    'instructor_name', CASE WHEN _instructor IS NOT NULL THEN _instructor.first_name || ' ' || _instructor.last_name ELSE NULL END
  );
END;
$function$;

-- One-time backfill: recompute enrollment for all future sessions so any prior
-- member-side cancellations that left stale counts are corrected now.
UPDATE public.class_sessions cs
SET current_enrollment = (
  SELECT COUNT(*)
  FROM public.class_bookings b
  WHERE b.session_id = cs.id
    AND b.status IN ('confirmed', 'completed')
),
    updated_at = now()
WHERE cs.session_date >= (now() AT TIME ZONE 'America/Chicago')::date;