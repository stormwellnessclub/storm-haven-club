-- 1. Update kiosk_class_roster to keep checked-in (status = 'completed') members visible
CREATE OR REPLACE FUNCTION public.kiosk_class_roster(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(row_to_json(r.*) ORDER BY r.name), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      cb.id AS booking_id,
      COALESCE(
        m.first_name || ' ' || m.last_name,
        cb.walk_in_name,
        'Unknown'
      ) AS name,
      cb.status,
      cb.checked_in_at,
      m.photo_url
    FROM class_bookings cb
    LEFT JOIN members m ON m.id = cb.member_id
    WHERE cb.session_id = p_session_id
      AND cb.status IN ('confirmed', 'checked_in', 'completed')
    ORDER BY COALESCE(m.first_name || ' ' || m.last_name, cb.walk_in_name, 'Unknown')
  ) r;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_class_roster(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.kiosk_class_roster(uuid) TO authenticated;

-- 2. Kiosk Kids Care check-in
CREATE OR REPLACE FUNCTION public.kiosk_check_in_kids_care(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.kids_care_bookings
  SET status = 'checked_in',
      checked_in_at = now(),
      updated_at = now()
  WHERE id = p_booking_id
    AND status IN ('confirmed', 'pending')
    AND checked_in_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found, already checked in, or not eligible');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_check_in_kids_care(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.kiosk_check_in_kids_care(uuid) TO authenticated;

-- 3. Kiosk Kids Care check-out
CREATE OR REPLACE FUNCTION public.kiosk_check_out_kids_care(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.kids_care_bookings
  SET status = 'checked_out',
      checked_out_at = now(),
      updated_at = now()
  WHERE id = p_booking_id
    AND status = 'checked_in';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found or not currently checked in');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_check_out_kids_care(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.kiosk_check_out_kids_care(uuid) TO authenticated;

-- 4. Kiosk Kids Care roster (for the front desk page)
CREATE OR REPLACE FUNCTION public.kiosk_kids_care_roster(p_booking_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(row_to_json(r.*) ORDER BY r.start_time, r.child_name), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      kcb.id,
      kcb.child_name,
      kcb.age_group,
      kcb.start_time,
      kcb.end_time,
      kcb.status,
      kcb.checked_in_at,
      kcb.checked_out_at,
      m.first_name AS parent_first_name,
      m.last_name  AS parent_last_name,
      m.phone      AS parent_phone
    FROM public.kids_care_bookings kcb
    LEFT JOIN public.members m ON m.id = kcb.member_id
    WHERE kcb.booking_date = p_booking_date
      AND kcb.status IN ('pending', 'confirmed', 'checked_in', 'checked_out')
    ORDER BY kcb.start_time, kcb.child_name
  ) r;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_kids_care_roster(date) TO anon;
GRANT EXECUTE ON FUNCTION public.kiosk_kids_care_roster(date) TO authenticated;