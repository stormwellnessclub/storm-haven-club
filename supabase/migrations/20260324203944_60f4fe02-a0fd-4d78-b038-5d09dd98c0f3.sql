
-- 1. Add UPDATE RLS policy for users on their own class_passes
CREATE POLICY "Users can update their own passes"
  ON public.class_passes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. Drop and recreate function with new return type
DROP FUNCTION IF EXISTS public.get_admin_kids_care_bookings(date, date, date, text, uuid, text);

CREATE OR REPLACE FUNCTION public.get_admin_kids_care_bookings(
  p_booking_date date DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_member_id uuid DEFAULT NULL,
  p_age_group text DEFAULT NULL
)
RETURNS TABLE(
  id uuid, member_id uuid, user_id uuid, child_name text, child_age integer, age_group text,
  booking_date date, start_time time, end_time time, status text, special_instructions text,
  checked_in_at timestamptz, checked_out_at timestamptz, checked_in_by uuid, checked_out_by uuid,
  parent_confirmed_pickup boolean, parent_confirmed_at timestamptz, room text,
  created_at timestamptz, updated_at timestamptz,
  parent_first_name text, parent_last_name text, parent_email text,
  child_allergies text, child_medical_conditions text, child_medications text,
  child_emergency_contact_name text, child_emergency_contact_phone text,
  child_relationship_to_child text, child_authorized_pickup_persons text,
  child_special_instructions text, child_photo_release boolean, child_preferred_activities text,
  pass_id uuid, pass_type text, pass_status text,
  pass_classes_remaining integer, pass_classes_total integer,
  pass_purchased_at timestamptz, pass_expires_at timestamptz,
  child_profile_found boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'childcare_staff', 'front_desk']::app_role[]) THEN
    RAISE EXCEPTION 'Unauthorized: staff role required';
  END IF;

  RETURN QUERY
  SELECT
    b.id, b.member_id, b.user_id, b.child_name, b.child_age, b.age_group,
    b.booking_date, b.start_time, b.end_time, b.status, b.special_instructions,
    b.checked_in_at, b.checked_out_at, b.checked_in_by, b.checked_out_by,
    b.parent_confirmed_pickup, b.parent_confirmed_at, b.room, b.created_at, b.updated_at,
    COALESCE(p.first_name, m.first_name, '') AS parent_first_name,
    COALESCE(p.last_name, m.last_name, '') AS parent_last_name,
    COALESCE(p.email, m.email, '') AS parent_email,
    NULLIF(NULLIF(TRIM(kc.allergies), ''), 'None') AS child_allergies,
    NULLIF(NULLIF(TRIM(kc.medical_conditions), ''), 'None') AS child_medical_conditions,
    NULLIF(NULLIF(TRIM(kc.medications), ''), 'None') AS child_medications,
    kc.emergency_contact_name AS child_emergency_contact_name,
    kc.emergency_contact_phone AS child_emergency_contact_phone,
    kc.relationship_to_child AS child_relationship_to_child,
    kc.authorized_pickup_persons AS child_authorized_pickup_persons,
    NULLIF(NULLIF(TRIM(kc.special_instructions), ''), 'None') AS child_special_instructions,
    kc.photo_release AS child_photo_release,
    kc.preferred_activities AS child_preferred_activities,
    cp.id AS pass_id,
    cp.pass_type AS pass_type,
    cp.status::text AS pass_status,
    cp.classes_remaining::integer AS pass_classes_remaining,
    cp.classes_total::integer AS pass_classes_total,
    cp.purchased_at::timestamptz AS pass_purchased_at,
    cp.expires_at::timestamptz AS pass_expires_at,
    (kc.id IS NOT NULL) AS child_profile_found
  FROM kids_care_bookings b
  LEFT JOIN profiles p ON p.user_id = b.user_id
  LEFT JOIN members m ON m.id = b.member_id
  LEFT JOIN kids_care_children kc ON kc.user_id = b.user_id AND LOWER(TRIM(kc.full_name)) = LOWER(TRIM(b.child_name)) AND kc.is_active = true
  LEFT JOIN class_passes cp ON cp.id = b.pass_id
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
