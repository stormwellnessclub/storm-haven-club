
CREATE OR REPLACE FUNCTION public.admin_create_kids_care_booking(p_user_id uuid, p_member_id uuid, p_child_name text, p_child_age integer, p_booking_date date, p_start_time time without time zone, p_end_time time without time zone, p_pass_id uuid, p_special_instructions text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pass RECORD;
  v_age_group text;
  v_room text;
  v_booking_id uuid;
  v_child_dob date;
  v_existing_child text;
BEGIN
  -- Staff role check
  IF NOT has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'childcare_staff', 'front_desk']::app_role[]) THEN
    RAISE EXCEPTION 'Unauthorized: staff role required';
  END IF;

  -- Validate pass
  SELECT * INTO v_pass FROM class_passes
  WHERE id = p_pass_id AND user_id = p_user_id AND status = 'active'
    AND classes_remaining > 0 AND expires_at > now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No valid active pass found';
  END IF;

  -- Per-child pass validation: check if pass is already used by a different child
  SELECT DISTINCT child_name INTO v_existing_child
  FROM kids_care_bookings
  WHERE pass_id = p_pass_id
    AND status NOT IN ('cancelled', 'no_show')
    AND LOWER(TRIM(child_name)) != LOWER(TRIM(p_child_name))
  LIMIT 1;

  IF v_existing_child IS NOT NULL THEN
    RAISE EXCEPTION 'This pass is already assigned to %. Each child needs their own pass.', v_existing_child;
  END IF;

  -- Check for existing booking same child same date
  IF EXISTS (
    SELECT 1 FROM kids_care_bookings
    WHERE user_id = p_user_id AND booking_date = p_booking_date
      AND LOWER(TRIM(child_name)) = LOWER(TRIM(p_child_name))
      AND status IN ('confirmed', 'checked_in')
  ) THEN
    RAISE EXCEPTION 'This child already has a booking for this date';
  END IF;

  -- Determine age group
  IF p_child_age < 1 THEN v_age_group := 'Infants';
  ELSIF p_child_age < 3 THEN v_age_group := 'Toddlers';
  ELSIF p_child_age < 5 THEN v_age_group := 'Preschool';
  ELSE v_age_group := 'School Age';
  END IF;

  -- Determine room
  IF v_age_group IN ('Infants', 'Toddlers') THEN v_room := 'Little Stars';
  ELSE v_room := 'Big Stars';
  END IF;

  -- Get child DOB if available
  SELECT date_of_birth INTO v_child_dob
  FROM kids_care_children
  WHERE user_id = p_user_id AND LOWER(TRIM(full_name)) = LOWER(TRIM(p_child_name)) AND is_active = true
  LIMIT 1;

  -- Create booking
  INSERT INTO kids_care_bookings (
    member_id, user_id, child_name, child_age, child_dob,
    booking_date, start_time, end_time, status,
    pass_id, age_group, room, special_instructions
  ) VALUES (
    p_member_id, p_user_id, p_child_name, p_child_age, v_child_dob,
    p_booking_date, p_start_time, p_end_time, 'confirmed',
    p_pass_id, v_age_group, v_room, p_special_instructions
  ) RETURNING id INTO v_booking_id;

  -- Deduct from pass
  UPDATE class_passes
  SET classes_remaining = classes_remaining - 1,
      status = CASE WHEN classes_remaining - 1 <= 0 THEN 'exhausted'::pass_status ELSE status END,
      updated_at = now()
  WHERE id = p_pass_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'age_group', v_age_group,
    'room', v_room
  );
END;
$function$;
