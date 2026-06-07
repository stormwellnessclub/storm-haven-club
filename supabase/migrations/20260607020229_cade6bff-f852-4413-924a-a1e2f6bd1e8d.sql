
-- Class booking: block credit-based bookings when past due (passes still allowed)
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
  SELECT email INTO _user_email FROM auth.users WHERE id = _user_id;
  IF is_email_blocked(_user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your access has been revoked. Please contact the club.');
  END IF;

  SELECT * INTO _session_record FROM class_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Class session not found');
  END IF;

  IF _session_record.is_fundraiser THEN
    RETURN jsonb_build_object('success', false, 'error', 'This is a fundraiser class. Class credits and passes cannot be used — please complete checkout to donate the full amount and reserve your spot.');
  END IF;

  IF _payment_method NOT IN ('credits', 'pass') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid payment method. Please use class credits or a class pass.');
  END IF;

  IF _payment_method = 'credits' AND _member_credit_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No class credits specified. Please purchase a class pass.');
  END IF;

  IF _payment_method = 'pass' AND _pass_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No class pass specified. Please select a class pass.');
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

  -- PAST-DUE GUARD: included monthly credits are paused while past due.
  -- Class-pass bookings remain allowed (they were paid out of pocket).
  IF _payment_method = 'credits' AND _member_id IS NOT NULL AND public.is_member_past_due(_member_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Account past due — please update your payment method, or proceed at the drop-in rate.'
    );
  END IF;

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

  RETURN jsonb_build_object('success', true, 'booking_id', _booking_id);
END;
$function$;

-- Wellness booking: block credit-backed sessions when past due
CREATE OR REPLACE FUNCTION public.book_wellness_appointment(p_service_id text, p_service_name text, p_service_category text, p_service_price numeric, p_appointment_date date, p_appointment_time time without time zone, p_duration_minutes integer, p_cleanup_minutes integer, p_credit_type text, p_member_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_member_id uuid;
  v_credit record;
  v_appointment_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id INTO v_member_id
  FROM public.members
  WHERE user_id = v_user_id AND status IN ('active', 'frozen')
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active membership found');
  END IF;

  -- PAST-DUE GUARD: included wellness credits are paused while past due.
  IF public.is_member_past_due(v_member_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Account past due — please update your payment method to use your included wellness credits, or book and pay at the drop-in rate.'
    );
  END IF;

  SELECT * INTO v_credit
  FROM public.member_credits
  WHERE member_id = v_member_id
    AND credit_type = p_credit_type::credit_type
    AND credits_remaining > 0
    AND expires_at > now()
  ORDER BY expires_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_credit.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No available wellness credits of type ' || p_credit_type);
  END IF;

  UPDATE public.member_credits
  SET credits_remaining = credits_remaining - 1,
      updated_at = now()
  WHERE id = v_credit.id;

  INSERT INTO public.spa_appointments (
    member_id, user_id, service_id, service_name, service_category,
    service_price, member_price, appointment_date, appointment_time,
    duration_minutes, cleanup_minutes, payment_method, amount_paid,
    credit_id, credit_type, member_notes, status
  ) VALUES (
    v_member_id, v_user_id, p_service_id, p_service_name, p_service_category,
    p_service_price, 0, p_appointment_date, p_appointment_time,
    p_duration_minutes, p_cleanup_minutes, 'credit', 0,
    v_credit.id, p_credit_type::credit_type, p_member_notes, 'confirmed'
  )
  RETURNING id INTO v_appointment_id;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'credits_remaining', v_credit.credits_remaining - 1
  );
END;
$function$;
