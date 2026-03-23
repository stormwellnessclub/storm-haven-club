-- Fix #1: Remove manual enrollment increment from create_atomic_class_booking
-- The trigger update_enrollment_on_booking already handles this
CREATE OR REPLACE FUNCTION public.create_atomic_class_booking(_session_id uuid, _user_id uuid, _payment_method text, _member_credit_id uuid DEFAULT NULL::uuid, _pass_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _member_id uuid;
  _booking_id uuid;
  _session_record record;
  _credit_record record;
  _pass_record record;
  _existing_booking record;
  _user_email text;
BEGIN
  -- BLOCKED CHECK
  SELECT email INTO _user_email FROM auth.users WHERE id = _user_id;
  IF is_email_blocked(_user_email) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Your access has been revoked. Please contact the club.'
    );
  END IF;

  -- PAYMENT VALIDATION
  IF _payment_method NOT IN ('credits', 'pass') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid payment method. Please use class credits or a class pass.');
  END IF;
  
  IF _payment_method = 'credits' AND _member_credit_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No class credits specified. Please purchase a class pass.');
  END IF;
  
  IF _payment_method = 'pass' AND _pass_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No class pass specified. Please select a class pass.');
  END IF;

  SELECT * INTO _session_record FROM class_sessions WHERE id = _session_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Class session not found');
  END IF;

  IF _session_record.is_cancelled THEN
    RETURN jsonb_build_object('success', false, 'error', 'This class has been cancelled');
  END IF;

  IF _session_record.current_enrollment >= _session_record.max_capacity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Class is full');
  END IF;

  SELECT * INTO _existing_booking FROM class_bookings WHERE session_id = _session_id AND user_id = _user_id AND status = 'confirmed';

  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a booking for this class');
  END IF;

  SELECT id INTO _member_id FROM members WHERE user_id = _user_id AND status = 'active';

  IF _payment_method = 'credits' AND _member_credit_id IS NOT NULL THEN
    SELECT * INTO _credit_record FROM member_credits WHERE id = _member_credit_id AND credits_remaining > 0 AND expires_at > NOW() FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'No available class credits');
    END IF;

    UPDATE member_credits SET credits_remaining = credits_remaining - 1 WHERE id = _member_credit_id;
  END IF;

  IF _payment_method = 'pass' AND _pass_id IS NOT NULL THEN
    SELECT * INTO _pass_record FROM class_passes WHERE id = _pass_id AND user_id = _user_id AND status = 'active' AND classes_remaining > 0 AND expires_at > NOW() FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired class pass');
    END IF;

    UPDATE class_passes
    SET classes_remaining = classes_remaining - 1,
        status = CASE WHEN classes_remaining - 1 <= 0 THEN 'exhausted'::pass_status ELSE status END
    WHERE id = _pass_id;
  END IF;

  INSERT INTO class_bookings (
    session_id, user_id, member_id, status, payment_method,
    member_credit_id, pass_id, credits_used, booked_at
  ) VALUES (
    _session_id, _user_id, _member_id, 'confirmed', _payment_method,
    _member_credit_id, _pass_id,
    CASE WHEN _payment_method = 'credits' THEN 1 ELSE 0 END,
    NOW()
  ) RETURNING id INTO _booking_id;

  -- REMOVED: Manual enrollment increment - trigger handles this automatically

  RETURN jsonb_build_object('success', true, 'booking_id', _booking_id);
END;
$function$;

-- Fix #1b: Recalculate all existing session enrollment counts
UPDATE class_sessions cs
SET current_enrollment = (
  SELECT COUNT(*) FROM class_bookings cb
  WHERE cb.session_id = cs.id AND cb.status = 'confirmed'
);

-- Fix #9: Timezone-aware cancellation policy
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

  -- Fix #9: Use explicit timezone for Dallas/Houston area
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