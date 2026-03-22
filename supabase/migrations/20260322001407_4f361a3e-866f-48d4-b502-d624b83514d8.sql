
-- Admin cancel kids care booking: cancels and restores pass credit atomically
CREATE OR REPLACE FUNCTION public.admin_cancel_kids_care_booking(
  p_booking_id uuid,
  p_cancellation_reason text DEFAULT 'Cancelled by admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_pass_id uuid;
BEGIN
  -- Staff role check
  IF NOT has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'childcare_staff', 'front_desk']::app_role[]) THEN
    RAISE EXCEPTION 'Unauthorized: staff role required';
  END IF;

  -- Get booking
  SELECT * INTO v_booking FROM kids_care_bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF v_booking.status IN ('cancelled', 'checked_out') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking is already ' || v_booking.status);
  END IF;

  -- Cancel the booking
  UPDATE kids_care_bookings
  SET status = 'cancelled',
      cancellation_reason = p_cancellation_reason,
      cancelled_at = now(),
      updated_at = now()
  WHERE id = p_booking_id;

  -- Restore pass credit
  v_pass_id := v_booking.pass_id;
  IF v_pass_id IS NOT NULL THEN
    UPDATE class_passes
    SET classes_remaining = classes_remaining + 1,
        status = 'active',
        updated_at = now()
    WHERE id = v_pass_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Admin create kids care booking on behalf of a parent
CREATE OR REPLACE FUNCTION public.admin_create_kids_care_booking(
  p_user_id uuid,
  p_member_id uuid,
  p_child_name text,
  p_child_age integer,
  p_booking_date date,
  p_start_time time,
  p_end_time time,
  p_pass_id uuid,
  p_special_instructions text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pass RECORD;
  v_age_group text;
  v_room text;
  v_booking_id uuid;
  v_child_dob date;
BEGIN
  -- Staff role check
  IF NOT has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'childcare_staff', 'front_desk']::app_role[]) THEN
    RAISE EXCEPTION 'Unauthorized: staff role required';
  END IF;

  -- Validate pass
  SELECT * INTO v_pass FROM class_passes
  WHERE id = p_pass_id AND user_id = p_user_id AND status = 'active' AND classes_remaining > 0 AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No valid active pass found for this member');
  END IF;

  -- Determine age group
  IF p_child_age < 1 THEN v_age_group := 'Infants'; v_room := 'Little Stars';
  ELSIF p_child_age < 3 THEN v_age_group := 'Toddlers'; v_room := 'Little Stars';
  ELSIF p_child_age < 5 THEN v_age_group := 'Preschool'; v_room := 'Big Stars';
  ELSE v_age_group := 'School Age'; v_room := 'Big Stars';
  END IF;

  -- Try to get child DOB
  SELECT date_of_birth INTO v_child_dob FROM kids_care_children
  WHERE user_id = p_user_id AND full_name = p_child_name AND is_active = true LIMIT 1;

  -- Deduct pass credit
  UPDATE class_passes
  SET classes_remaining = classes_remaining - 1,
      status = CASE WHEN classes_remaining - 1 <= 0 THEN 'exhausted'::pass_status ELSE status END,
      updated_at = now()
  WHERE id = p_pass_id;

  -- Create booking
  INSERT INTO kids_care_bookings (
    user_id, member_id, child_name, child_age, child_dob,
    booking_date, start_time, end_time, status, pass_id,
    age_group, room, special_instructions
  ) VALUES (
    p_user_id, p_member_id, p_child_name, p_child_age, v_child_dob,
    p_booking_date, p_start_time, p_end_time, 'confirmed', p_pass_id,
    v_age_group, v_room, p_special_instructions
  ) RETURNING id INTO v_booking_id;

  RETURN jsonb_build_object('success', true, 'booking_id', v_booking_id);
END;
$$;
