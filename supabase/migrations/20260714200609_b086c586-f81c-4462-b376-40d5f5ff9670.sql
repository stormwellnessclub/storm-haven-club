
DO $$
DECLARE
  v_user_id uuid;
  v_instructor_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = 'storm@stormwellnessclub.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No auth user found for storm@stormwellnessclub.com; skipping link.';
    RETURN;
  END IF;

  SELECT id INTO v_instructor_id
  FROM public.instructors
  WHERE lower(email) = 'storm@stormwellnessclub.com'
  LIMIT 1;

  IF v_instructor_id IS NULL THEN
    INSERT INTO public.instructors (
      first_name, last_name, email, is_active, portal_enabled, pay_type,
      default_per_class_rate, hourly_rate, user_id
    ) VALUES (
      'Storm', 'Admin', 'storm@stormwellnessclub.com', true, true, 'per_class',
      0, 0, v_user_id
    )
    RETURNING id INTO v_instructor_id;
  ELSE
    UPDATE public.instructors
       SET user_id = v_user_id,
           is_active = true,
           portal_enabled = true
     WHERE id = v_instructor_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_get_instructor_context(_instructor_id uuid)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  email text,
  photo_url text,
  pay_type text,
  default_per_class_rate numeric,
  hourly_rate numeric,
  is_active boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
    SELECT i.id, i.first_name, i.last_name, i.email, i.photo_url,
           i.pay_type::text, i.default_per_class_rate, i.hourly_rate, i.is_active
      FROM public.instructors i
     WHERE i.id = _instructor_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_instructor_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_instructor_context(uuid) TO authenticated;
