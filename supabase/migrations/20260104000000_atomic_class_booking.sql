-- =====================================================
-- FUNCTION: Atomic class booking with capacity checking
-- =====================================================
-- This function ensures atomic booking operations:
-- 1. Checks session capacity (with row locking)
-- 2. Prevents duplicate bookings
-- 3. Creates booking record
-- 4. Deducts credits/pass if payment method requires it
-- 5. Updates enrollment (handled by trigger)
-- All in a single transaction to prevent race conditions
-- =====================================================

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
  _session_record record;
  _member_id uuid;
  _booking_id uuid;
  _credit_record record;
  _pass_record record;
  _existing_booking_id uuid;
  _result jsonb;
BEGIN
  -- Get member_id for this user
  SELECT id INTO _member_id
  FROM public.members
  WHERE user_id = _user_id
  LIMIT 1;

  -- Lock the session row to prevent concurrent bookings
  SELECT * INTO _session_record
  FROM public.class_sessions
  WHERE id = _session_id
  FOR UPDATE;

  -- Check if session exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Session not found'
    );
  END IF;

  -- Check if session is cancelled
  IF _session_record.is_cancelled THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This class has been cancelled'
    );
  END IF;

  -- Check capacity (using locked row to ensure accuracy)
  IF _session_record.current_enrollment >= _session_record.max_capacity THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This class is full'
    );
  END IF;

  -- Check for existing confirmed booking
  SELECT id INTO _existing_booking_id
  FROM public.class_bookings
  WHERE session_id = _session_id
    AND user_id = _user_id
    AND status = 'confirmed'
  LIMIT 1;

  IF _existing_booking_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You have already booked this class'
    );
  END IF;

  -- Handle credit deduction if payment method is 'credits'
  IF _payment_method = 'credits' AND _member_credit_id IS NOT NULL THEN
    -- Lock the credit row
    SELECT * INTO _credit_record
    FROM public.member_credits
    WHERE id = _member_credit_id
      AND user_id = _user_id
      AND credit_type = 'class'
      AND expires_at > now()
      AND credits_remaining > 0
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'No available class credits'
      );
    END IF;

    -- Deduct the credit
    UPDATE public.member_credits
    SET credits_remaining = credits_remaining - 1,
        updated_at = now()
    WHERE id = _member_credit_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to deduct credit'
      );
    END IF;
  END IF;

  -- Handle pass deduction if payment method is 'pass'
  IF _payment_method = 'pass' AND _pass_id IS NOT NULL THEN
    -- Lock the pass row
    SELECT * INTO _pass_record
    FROM public.class_passes
    WHERE id = _pass_id
      AND user_id = _user_id
      AND status = 'active'
      AND classes_remaining > 0
      AND expires_at > now()
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'This pass has no remaining classes or is expired'
      );
    END IF;

    -- Deduct from pass
    UPDATE public.class_passes
    SET classes_remaining = classes_remaining - 1,
        updated_at = now()
    WHERE id = _pass_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to deduct from pass'
      );
    END IF;
  END IF;

  -- Create the booking (enrollment will be updated by trigger)
  INSERT INTO public.class_bookings (
    session_id,
    user_id,
    member_id,
    status,
    payment_method,
    member_credit_id,
    pass_id,
    credits_used
  ) VALUES (
    _session_id,
    _user_id,
    _member_id,
    'confirmed',
    _payment_method,
    _member_credit_id,
    _pass_id,
    CASE WHEN _payment_method IN ('credits', 'pass') THEN 1 ELSE 0 END
  )
  RETURNING id INTO _booking_id;

  -- Return success with booking ID
  RETURN jsonb_build_object(
    'success', true,
    'booking_id', _booking_id,
    'member_id', _member_id
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Rollback will happen automatically
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_atomic_class_booking TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.create_atomic_class_booking IS 
  'Atomically creates a class booking with capacity checking and credit/pass deduction. Prevents race conditions through row locking.';



