DROP POLICY IF EXISTS "Authenticated can view active instructors" ON public.instructors;
DROP POLICY IF EXISTS "Authenticated can view active spa therapists" ON public.spa_therapists;
DROP POLICY IF EXISTS "Public can view active spa therapists basic info" ON public.spa_therapists;

DROP POLICY IF EXISTS "Staff can view spa therapists" ON public.spa_therapists;
CREATE POLICY "Staff can view spa therapists"
ON public.spa_therapists
FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'spa_staff'::app_role, 'front_desk'::app_role]));

CREATE OR REPLACE FUNCTION public.get_public_instructors()
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  bio text,
  specialties text[],
  photo_url text,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.first_name, i.last_name, i.bio, i.specialties, i.photo_url, i.is_active
  FROM public.instructors i
  WHERE i.is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.get_public_spa_therapists()
RETURNS TABLE (
  id uuid,
  full_name text,
  first_name text,
  last_name text,
  bio text,
  specialties text[],
  photo_url text,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    st.id,
    st.full_name,
    split_part(st.full_name, ' ', 1) AS first_name,
    nullif(trim(substr(st.full_name, length(split_part(st.full_name, ' ', 1)) + 1)), '') AS last_name,
    st.bio,
    st.specialties,
    st.photo_url,
    st.is_active
  FROM public.spa_therapists st
  WHERE st.is_active = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_instructors() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_spa_therapists() TO anon, authenticated;