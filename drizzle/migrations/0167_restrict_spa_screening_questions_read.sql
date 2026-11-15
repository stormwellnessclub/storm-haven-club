CREATE OR REPLACE FUNCTION public.can_read_spa_screening(_service_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.spa_appointments a
    JOIN public.spa_services s ON s.id::text = a.service_id
    WHERE s.service_key = _service_key
      AND (a.user_id = auth.uid()
           OR (a.guest_email IS NOT NULL AND lower(trim(a.guest_email)) = public.current_user_email_lower()))
  )
$$;

REVOKE ALL ON FUNCTION public.can_read_spa_screening(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_spa_screening(text) TO authenticated;

DROP POLICY IF EXISTS "Signed-in users read screening questions" ON public.spa_screening_questions;

CREATE POLICY "Staff read screening questions"
ON public.spa_screening_questions
FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'spa_staff'::app_role, 'front_desk'::app_role]));

CREATE POLICY "Clients read screening questions for their treatment"
ON public.spa_screening_questions
FOR SELECT
TO authenticated
USING (is_active AND public.can_read_spa_screening(service_key));