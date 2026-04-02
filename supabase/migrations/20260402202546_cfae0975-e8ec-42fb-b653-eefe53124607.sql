
-- Add missing columns to spa_appointments
ALTER TABLE public.spa_appointments
  ADD COLUMN IF NOT EXISTS credit_id uuid REFERENCES public.member_credits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credit_type public.credit_type;

-- Fix the member-facing book_wellness_appointment RPC
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

  -- Allow active AND frozen members to use existing wellness credits
  SELECT id INTO v_member_id
  FROM public.members
  WHERE user_id = v_user_id AND status IN ('active', 'frozen')
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active membership found');
  END IF;

  -- Find and lock a matching credit with remaining balance
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

  -- Check for appointment conflicts
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

  -- Create the spa appointment with correct column names
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
$$;

-- Create atomic staff booking function
CREATE OR REPLACE FUNCTION public.staff_book_wellness_appointment(
  p_member_id uuid,
  p_credit_type text,
  p_appointment_date date,
  p_appointment_time time,
  p_staff_notes text DEFAULT 'Booked by staff'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_credit record;
  v_member record;
  v_appointment_id uuid;
  v_service_name text;
  v_service_id integer;
  v_duration integer;
BEGIN
  -- Verify caller is staff
  IF NOT has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[]) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: staff role required');
  END IF;

  -- Get the member (allow active + frozen)
  SELECT id, user_id, status INTO v_member
  FROM public.members
  WHERE id = p_member_id AND status IN ('active', 'frozen')
  LIMIT 1;

  IF v_member.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member not found or inactive');
  END IF;

  -- Set service details
  IF p_credit_type = 'red_light' THEN
    v_service_name := 'Red Light Therapy';
    v_service_id := 101;
    v_duration := 20;
  ELSIF p_credit_type = 'dry_cryo' THEN
    v_service_name := 'Dry Cryotherapy';
    v_service_id := 102;
    v_duration := 3;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid credit type: ' || p_credit_type);
  END IF;

  -- Find and lock the credit row
  SELECT * INTO v_credit
  FROM public.member_credits
  WHERE member_id = p_member_id
    AND credit_type = p_credit_type::credit_type
    AND credits_remaining > 0
    AND expires_at > now()
  ORDER BY expires_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_credit.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No available ' || v_service_name || ' credits');
  END IF;

  -- Deduct credit
  UPDATE public.member_credits
  SET credits_remaining = credits_remaining - 1,
      updated_at = now()
  WHERE id = v_credit.id;

  -- Create the appointment
  INSERT INTO public.spa_appointments (
    member_id, user_id, service_id, service_name, service_category,
    service_price, member_price, appointment_date, appointment_time,
    duration_minutes, cleanup_minutes, payment_method, amount_paid,
    credit_id, credit_type, staff_notes, status
  ) VALUES (
    p_member_id, v_member.user_id, v_service_id, v_service_name, 'Recovery',
    0, 0, p_appointment_date, p_appointment_time,
    v_duration, 5, 'credit', 0,
    v_credit.id, p_credit_type::credit_type, p_staff_notes, 'confirmed'
  )
  RETURNING id INTO v_appointment_id;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'credits_remaining', v_credit.credits_remaining - 1,
    'service_name', v_service_name
  );
END;
$$;
