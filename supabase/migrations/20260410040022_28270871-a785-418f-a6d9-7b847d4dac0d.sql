
-- Drop and recreate the staff management policy to include front_desk
DROP POLICY IF EXISTS "Staff can manage all spa appointments" ON public.spa_appointments;
CREATE POLICY "Staff can manage all spa appointments"
ON public.spa_appointments FOR ALL TO authenticated
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'spa_staff'::app_role, 'front_desk'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'spa_staff'::app_role, 'front_desk'::app_role]));

-- Drop and recreate the staff view policy to include front_desk
DROP POLICY IF EXISTS "Staff can view all spa appointments" ON public.spa_appointments;
CREATE POLICY "Staff can view all spa appointments"
ON public.spa_appointments FOR SELECT TO authenticated
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'spa_staff'::app_role, 'front_desk'::app_role]));
