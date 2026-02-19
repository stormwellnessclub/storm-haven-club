
CREATE OR REPLACE FUNCTION public.book_wellness_appointment(
  p_service_id integer,
  p_service_name text,
  p_service_category text,
  p_service_price numeric,
  p_appointment_date date,
  p_appointment_time time,
  p_duration_minutes integer,
  p_cleanup_minutes integer,
  p_credit_type text,
  p_member_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_member_id uuid;
  v_credit record;
  v_appointment_id uuid;
  v_conflict record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get the member record
  SELECT id INTO v_member_id
  FROM public.members
  WHERE user_id = v_user_id AND status = 'active'
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active membership found');
  END IF;

  -- Find and lock a matching credit with remaining balance
  SELECT * INTO v_credit
  FROM public.member_credits
  WHERE member_id = v_member_id
    AND credit_type = p_credit_type
    AND credits_remaining > 0
    AND expires_at > now()
  ORDER BY expires_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_credit.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No available wellness credits of type ' || p_credit_type);
  END IF;

  -- Check for appointment conflicts using existing function
  SELECT * INTO v_conflict
  FROM public.check_spa_appointment_conflict(
    p_appointment_date,
    p_appointment_time,
    p_duration_minutes,
    p_cleanup_minutes
  );

  IF v_conflict.has_conflict THEN
    RETURN jsonb_build_object('success', false, 'error', 'Time slot conflicts with an existing appointment');
  END IF;

  -- Deduct the credit
  UPDATE public.member_credits
  SET credits_remaining = credits_remaining - 1,
      updated_at = now()
  WHERE id = v_credit.id;

  -- Create the spa appointment with credit tracking
  INSERT INTO public.spa_appointments (
    member_id,
    user_id,
    service_id,
    service_name,
    service_category,
    service_price,
    member_price,
    appointment_date,
    appointment_time,
    duration_minutes,
    cleanup_minutes,
    payment_method,
    amount_paid,
    credit_id,
    credit_type,
    notes,
    status
  ) VALUES (
    v_member_id,
    v_user_id,
    p_service_id,
    p_service_name,
    p_service_category,
    p_service_price,
    0,
    p_appointment_date,
    p_appointment_time,
    p_duration_minutes,
    p_cleanup_minutes,
    'credit',
    0,
    v_credit.id,
    p_credit_type,
    p_member_notes,
    'confirmed'
  )
  RETURNING id INTO v_appointment_id;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'credits_remaining', v_credit.credits_remaining - 1
  );
END;
$$;
