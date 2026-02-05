-- Update create_atomic_class_booking function to enforce payment validation
-- Rejects cash payments and requires valid credit/pass IDs

CREATE OR REPLACE FUNCTION public.create_atomic_class_booking(
  _session_id uuid,
  _user_id uuid,
  _payment_method text,
  _member_credit_id uuid DEFAULT NULL,
  _pass_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _member_id uuid;
  _booking_id uuid;
  _session_record record;
  _credit_record record;
  _pass_record record;
  _existing_booking record;
BEGIN
  -- PAYMENT VALIDATION: Only allow 'credits' or 'pass' payment methods
  IF _payment_method NOT IN ('credits', 'pass') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid payment method. Please use class credits or a class pass.'
    );
  END IF;
  
  -- PAYMENT VALIDATION: Require credit ID for credits payment
  IF _payment_method = 'credits' AND _member_credit_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No class credits specified. Please purchase a class pass.'
    );
  END IF;
  
  -- PAYMENT VALIDATION: Require pass ID for pass payment
  IF _payment_method = 'pass' AND _pass_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No class pass specified. Please select a class pass.'
    );
  END IF;

  -- Lock and get session to prevent race conditions
  SELECT * INTO _session_record
  FROM class_sessions
  WHERE id = _session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Class session not found'
    );
  END IF;

  -- Check if session is cancelled
  IF _session_record.is_cancelled THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This class has been cancelled'
    );
  END IF;

  -- Check capacity
  IF _session_record.current_enrollment >= _session_record.max_capacity THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Class is full'
    );
  END IF;

  -- Check for existing confirmed booking
  SELECT * INTO _existing_booking
  FROM class_bookings
  WHERE session_id = _session_id
    AND user_id = _user_id
    AND status = 'confirmed';

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You already have a booking for this class'
    );
  END IF;

  -- Get member_id if user is a member
  SELECT id INTO _member_id
  FROM members
  WHERE user_id = _user_id AND status = 'active';

  -- Handle credit payment
  IF _payment_method = 'credits' AND _member_credit_id IS NOT NULL THEN
    -- Lock and validate credit
    SELECT * INTO _credit_record
    FROM member_credits
    WHERE id = _member_credit_id
      AND credits_remaining > 0
      AND expires_at > NOW()
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'No available class credits'
      );
    END IF;

    -- Deduct credit
    UPDATE member_credits
    SET credits_remaining = credits_remaining - 1
    WHERE id = _member_credit_id;
  END IF;

  -- Handle pass payment
  IF _payment_method = 'pass' AND _pass_id IS NOT NULL THEN
    -- Lock and validate pass
    SELECT * INTO _pass_record
    FROM class_passes
    WHERE id = _pass_id
      AND user_id = _user_id
      AND status = 'active'
      AND classes_remaining > 0
      AND expires_at > NOW()
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid or expired class pass'
      );
    END IF;

    -- Deduct from pass
    UPDATE class_passes
    SET classes_remaining = classes_remaining - 1,
        status = CASE WHEN classes_remaining - 1 <= 0 THEN 'exhausted'::pass_status ELSE status END
    WHERE id = _pass_id;
  END IF;

  -- Create booking
  INSERT INTO class_bookings (
    session_id,
    user_id,
    member_id,
    status,
    payment_method,
    member_credit_id,
    pass_id,
    credits_used,
    booked_at
  ) VALUES (
    _session_id,
    _user_id,
    _member_id,
    'confirmed',
    _payment_method,
    _member_credit_id,
    _pass_id,
    CASE WHEN _payment_method = 'credits' THEN 1 ELSE 0 END,
    NOW()
  )
  RETURNING id INTO _booking_id;

  -- Update session enrollment
  UPDATE class_sessions
  SET current_enrollment = current_enrollment + 1
  WHERE id = _session_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', _booking_id
  );
END;
$$;