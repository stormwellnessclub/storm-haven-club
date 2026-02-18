-- Fix: Staff ALL policy needs WITH CHECK for INSERT to work
DROP POLICY "Staff can manage all spa appointments" ON public.spa_appointments;

CREATE POLICY "Staff can manage all spa appointments"
ON public.spa_appointments
FOR ALL
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'spa_staff'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'spa_staff'::app_role]));