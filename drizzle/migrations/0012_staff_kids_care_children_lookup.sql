CREATE OR REPLACE FUNCTION public.staff_get_kids_care_children(_user_id uuid)
RETURNS TABLE (id uuid, full_name text, date_of_birth date)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk','childcare_staff']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT c.id, c.full_name, c.date_of_birth
  FROM public.kids_care_children c
  WHERE c.user_id = _user_id
    AND c.is_active = true
  ORDER BY c.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_get_kids_care_children(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_get_kids_care_children(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_get_kids_care_children(uuid) TO service_role;