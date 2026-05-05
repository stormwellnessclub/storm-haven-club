
-- 1) Replace create_atomic_class_booking with fundraiser gate (preserves all existing behavior for non-fundraiser sessions)
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

  -- Load session early so we can check fundraiser flag
  SELECT * INTO _session_record FROM class_sessions WHERE id = _session_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Class session not found');
  END IF;

  -- FUNDRAISER GATE: credits/passes cannot be used; require checkout
  IF _session_record.is_fundraiser THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This is a fundraiser class. Class credits and passes cannot be used — please complete checkout to donate the full amount and reserve your spot.'
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

  RETURN jsonb_build_object('success', true, 'booking_id', _booking_id);
END;
$function$;

-- 2) Webhook fulfillment RPC for paid fundraiser bookings (idempotent)
CREATE OR REPLACE FUNCTION public.create_fundraiser_class_booking(
  _session_id uuid,
  _user_id uuid,
  _amount_cents integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _session_record record;
  _existing record;
  _member_id uuid;
  _booking_id uuid;
BEGIN
  SELECT * INTO _session_record FROM class_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Class session not found');
  END IF;

  IF NOT _session_record.is_fundraiser THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session is not a fundraiser');
  END IF;

  -- Idempotency: return existing confirmed booking if it exists
  SELECT * INTO _existing FROM class_bookings
   WHERE session_id = _session_id AND user_id = _user_id AND status = 'confirmed';
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'booking_id', _existing.id, 'already_existed', true);
  END IF;

  IF _session_record.is_cancelled THEN
    RETURN jsonb_build_object('success', false, 'error', 'This class has been cancelled');
  END IF;

  IF _session_record.current_enrollment >= _session_record.max_capacity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Class is full');
  END IF;

  SELECT id INTO _member_id FROM members WHERE user_id = _user_id AND status = 'active';

  INSERT INTO class_bookings (
    session_id, user_id, member_id, status, payment_method,
    amount_paid, credits_used, booked_at
  ) VALUES (
    _session_id, _user_id, _member_id, 'confirmed', 'cash',
    ROUND((_amount_cents::numeric) / 100.0, 2), 0, NOW()
  ) RETURNING id INTO _booking_id;

  RETURN jsonb_build_object('success', true, 'booking_id', _booking_id);
END;
$$;
