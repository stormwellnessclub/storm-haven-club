
CREATE OR REPLACE FUNCTION public.get_admin_kids_care_bookings(
  p_booking_date date DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_member_id uuid DEFAULT NULL,
  p_age_group text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  member_id uuid,
  user_id uuid,
  child_name text,
  child_age integer,
  age_group text,
  booking_date date,
  start_time time,
  end_time time,
  status text,
  special_instructions text,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  checked_in_by uuid,
  checked_out_by uuid,
  parent_confirmed_pickup boolean,
  parent_confirmed_at timestamptz,
  room text,
  created_at timestamptz,
  updated_at timestamptz,
  parent_first_name text,
  parent_last_name text,
  parent_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow staff roles
  IF NOT has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'childcare_staff', 'front_desk']::app_role[]) THEN
    RAISE EXCEPTION 'Unauthorized: staff role required';
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.member_id,
    b.user_id,
    b.child_name,
    b.child_age,
    b.age_group,
    b.booking_date,
    b.start_time,
    b.end_time,
    b.status,
    b.special_instructions,
    b.checked_in_at,
    b.checked_out_at,
    b.checked_in_by,
    b.checked_out_by,
    b.parent_confirmed_pickup,
    b.parent_confirmed_at,
    b.room,
    b.created_at,
    b.updated_at,
    COALESCE(p.first_name, m.first_name, '') AS parent_first_name,
    COALESCE(p.last_name, m.last_name, '') AS parent_last_name,
    COALESCE(p.email, m.email, '') AS parent_email
  FROM kids_care_bookings b
  LEFT JOIN profiles p ON p.user_id = b.user_id
  LEFT JOIN members m ON m.id = b.member_id
  WHERE
    (p_booking_date IS NULL OR b.booking_date = p_booking_date)
    AND (p_date_from IS NULL OR b.booking_date >= p_date_from)
    AND (p_date_to IS NULL OR b.booking_date <= p_date_to)
    AND (p_status IS NULL OR b.status = p_status)
    AND (p_member_id IS NULL OR b.member_id = p_member_id)
    AND (p_age_group IS NULL OR b.age_group = p_age_group)
  ORDER BY b.booking_date ASC, b.start_time ASC;
END;
$$;
