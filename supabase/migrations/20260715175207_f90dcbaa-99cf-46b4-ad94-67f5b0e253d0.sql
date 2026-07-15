DROP POLICY IF EXISTS "Staff can view credit adjustments" ON public.credit_adjustments;
CREATE POLICY "Staff can view credit adjustments"
ON public.credit_adjustments FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));