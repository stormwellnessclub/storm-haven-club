-- Kids Care member flows: guard_member_field_tamper (now SECURITY INVOKER) blocks
-- members from writing class_passes.classes_remaining directly, so the website's
-- deduct/refund updates silently failed. Booking + deduction and cancel + refund
-- now run atomically inside SECURITY DEFINER functions scoped to auth.uid().

CREATE OR REPLACE FUNCTION public.member_book_kids_care(
  p_pass_id uuid,
  p_child_name text,
  p_child_age numeric,
  p_child_dob date,
  p_booking_date date,
  p_start_time time,
  p_end_time time,
  p_special_instructions text DEFAULT NULL,
  p_parent_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pass public.class_passes%ROWTYPE;
  v_member_id uuid;
  v_existing_child text;
  v_age_group text;
  v_room text;
  v_minutes integer;
  v_booking public.kids_care_bookings%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to book kids care' USING ERRCODE = '42501';
  END IF;

  IF p_child_name IS NULL OR btrim(p_child_name) = '' THEN
    RAISE EXCEPTION 'Child name is required';
  END IF;

  v_minutes := (EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 60)::integer;
  IF v_minutes <= 0 OR v_minutes > 120 THEN
    RAISE EXCEPTION 'Kids care sessions must be between 1 minute and 2 hours';
  END IF;

  SELECT * INTO v_pass
    FROM public.class_passes
   WHERE id = p_pass_id
     AND user_id = v_uid
   FOR UPDATE;

  IF NOT FOUND
     OR v_pass.status::text <> 'active'
     OR v_pass.classes_remaining <= 0
     OR v_pass.expires_at <= now()
     OR NOT (lower(coalesce(v_pass.pass_type, '')) LIKE '%kids%'
             OR lower(coalesce(v_pass.pass_type, '')) LIKE '%care%') THEN
    RAISE EXCEPTION 'Valid Kids Care Pass required. Please purchase a Kids Care Pass first.';
  END IF;

  SELECT id INTO v_member_id
    FROM public.members
   WHERE user_id = v_uid
   LIMIT 1;
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Membership required to book kids care';
  END IF;

  SELECT child_name INTO v_existing_child
    FROM public.kids_care_bookings
   WHERE pass_id = p_pass_id
     AND status NOT IN ('cancelled', 'no_show')
     AND lower(btrim(child_name)) <> lower(btrim(p_child_name))
   LIMIT 1;
  IF v_existing_child IS NOT NULL THEN
    RAISE EXCEPTION 'This pass is already assigned to %. Each child needs their own pass.', v_existing_child;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.kids_care_bookings
     WHERE user_id = v_uid
       AND booking_date = p_booking_date
       AND lower(btrim(child_name)) = lower(btrim(p_child_name))
       AND status IN ('confirmed', 'checked_in')
  ) THEN
    RAISE EXCEPTION 'This child already has a booking for this date';
  END IF;

  -- Same buckets as the website's getAgeGroup()
  v_age_group := CASE
    WHEN p_child_age >= 0.333 AND p_child_age < 1 THEN 'Infants'
    WHEN p_child_age >= 1 AND p_child_age < 3 THEN 'Toddlers'
    WHEN p_child_age >= 3 AND p_child_age < 5 THEN 'Preschool'
    WHEN p_child_age >= 5 AND p_child_age <= 8 THEN 'School Age'
    ELSE 'Unknown'
  END;
  v_room := CASE WHEN v_age_group IN ('Infants', 'Toddlers') THEN 'Little Stars' ELSE 'Big Stars' END;

  INSERT INTO public.kids_care_bookings (
    member_id, user_id, child_name, child_age, child_dob,
    booking_date, start_time, end_time, status,
    pass_id, age_group, room, special_instructions, parent_notes
  ) VALUES (
    v_member_id, v_uid, btrim(p_child_name), round(p_child_age)::integer, p_child_dob,
    p_booking_date, p_start_time, p_end_time, 'confirmed',
    p_pass_id, v_age_group, v_room, NULLIF(p_special_instructions, ''), NULLIF(p_parent_notes, '')
  )
  RETURNING * INTO v_booking;

  UPDATE public.class_passes
     SET classes_remaining = classes_remaining - 1,
         status = CASE WHEN classes_remaining - 1 <= 0 THEN 'exhausted'::pass_status ELSE status END,
         updated_at = now()
   WHERE id = p_pass_id;

  RETURN to_jsonb(v_booking);
END;
$$;

REVOKE ALL ON FUNCTION public.member_book_kids_care(uuid, text, numeric, date, date, time, time, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_book_kids_care(uuid, text, numeric, date, date, time, time, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.member_cancel_kids_care_booking(
  p_booking_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_booking public.kids_care_bookings%ROWTYPE;
  v_start timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_booking
    FROM public.kids_care_bookings
   WHERE id = p_booking_id
     AND user_id = v_uid
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.status <> 'confirmed' THEN
    RAISE EXCEPTION 'This booking can no longer be cancelled';
  END IF;

  v_start := (v_booking.booking_date + v_booking.start_time) AT TIME ZONE 'America/Detroit';
  IF v_start - now() < interval '2 hours' THEN
    RAISE EXCEPTION 'Cancellations must be made at least 2 hours before the booking start time';
  END IF;

  UPDATE public.kids_care_bookings
     SET status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = coalesce(NULLIF(p_reason, ''), 'Cancelled by parent'),
         updated_at = now()
   WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  IF v_booking.pass_id IS NOT NULL THEN
    UPDATE public.class_passes
       SET classes_remaining = LEAST(classes_remaining + 1, coalesce(classes_total, classes_remaining + 1)),
           status = CASE WHEN status::text IN ('active', 'exhausted') THEN 'active'::pass_status ELSE status END,
           updated_at = now()
     WHERE id = v_booking.pass_id;
  END IF;

  RETURN to_jsonb(v_booking);
END;
$$;

REVOKE ALL ON FUNCTION public.member_cancel_kids_care_booking(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_cancel_kids_care_booking(uuid, text) TO authenticated;