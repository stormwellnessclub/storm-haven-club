-- Restrict overly broad authenticated read policies to staff only

DROP POLICY IF EXISTS "Authenticated read settings" ON public.cafe_marketing_settings;
CREATE POLICY "Staff read settings" ON public.cafe_marketing_settings
FOR SELECT TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role,'front_desk'::app_role]));

DROP POLICY IF EXISTS "auth read pt availability" ON public.pt_trainer_availability;
CREATE POLICY "staff read pt availability" ON public.pt_trainer_availability
FOR SELECT TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role,'front_desk'::app_role,'class_instructor'::app_role]));

DROP POLICY IF EXISTS "auth read pt formats" ON public.pt_trainer_formats;
CREATE POLICY "staff read pt formats" ON public.pt_trainer_formats
FOR SELECT TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role,'front_desk'::app_role,'class_instructor'::app_role]));

DROP POLICY IF EXISTS "read pt trainer locations" ON public.pt_trainer_locations;
CREATE POLICY "staff read pt trainer locations" ON public.pt_trainer_locations
FOR SELECT TO authenticated
USING (public.pt_is_staff(auth.uid()));

DROP POLICY IF EXISTS "auth read pt overrides" ON public.pt_trainer_overrides;
CREATE POLICY "staff read pt overrides" ON public.pt_trainer_overrides
FOR SELECT TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role,'front_desk'::app_role,'class_instructor'::app_role]));