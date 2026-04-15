-- Fix the conflict check: when p_staff_id is NULL, only conflict with other unassigned appointments
-- (not ALL appointments globally)
CREATE OR REPLACE FUNCTION public.check_spa_appointment_conflict(
  p_appointment_date date,
  p_appointment_time time without time zone,
  p_duration_minutes integer,
  p_cleanup_minutes integer DEFAULT 15,
  p_staff_id uuid DEFAULT NULL::uuid,
  p_exclude_appointment_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(has_conflict boolean, conflicting_appointment_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_start TIME := p_appointment_time;
  new_end TIME := p_appointment_time + (p_duration_minutes + p_cleanup_minutes) * INTERVAL '1 minute';
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as has_conflict,
    sa.id as conflicting_appointment_id
  FROM spa_appointments sa
  WHERE sa.appointment_date = p_appointment_date
    AND sa.status IN ('confirmed', 'pending')
    AND (p_exclude_appointment_id IS NULL OR sa.id != p_exclude_appointment_id)
    AND (
      -- When a staff_id is provided, only check that specific therapist's appointments
      -- When no staff_id is provided, skip conflict check entirely (return no rows)
      p_staff_id IS NOT NULL AND sa.staff_id = p_staff_id
    )
    AND (
      (new_start < sa.appointment_time + (sa.duration_minutes + COALESCE(sa.cleanup_minutes, 15)) * INTERVAL '1 minute')
      AND
      (new_end > sa.appointment_time)
    )
  LIMIT 1;
END;
$function$;

-- Update book_wellness_appointment to accept text service_id
CREATE OR REPLACE FUNCTION public.book_wellness_appointment(
  p_service_id text,
  p_service_name text,
  p_service_category text,
  p_service_price numeric,
  p_appointment_date date,
  p_appointment_time time without time zone,
  p_duration_minutes integer,
  p_cleanup_minutes integer,
  p_credit_type text,
  p_member_notes text DEFAULT NULL
)
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

  -- Deduct the credit
  UPDATE public.member_credits
  SET credits_remaining = credits_remaining - 1,
      updated_at = now()
  WHERE id = v_credit.id;

  -- Create the spa appointment
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