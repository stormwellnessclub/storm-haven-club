DROP POLICY IF EXISTS "cafe_staff_insert_orders" ON public.cafe_orders;
DROP POLICY IF EXISTS "cafe_staff_update_orders" ON public.cafe_orders;
DROP POLICY IF EXISTS "cafe_staff_select_orders" ON public.cafe_orders;

CREATE POLICY "staff_pos_insert_orders" ON public.cafe_orders
FOR INSERT TO authenticated
WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role,'cafe_staff'::app_role,'front_desk'::app_role]));

CREATE POLICY "staff_pos_update_orders" ON public.cafe_orders
FOR UPDATE TO authenticated
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role,'cafe_staff'::app_role,'front_desk'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role,'cafe_staff'::app_role,'front_desk'::app_role]));

CREATE POLICY "staff_pos_select_orders" ON public.cafe_orders
FOR SELECT TO authenticated
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role,'cafe_staff'::app_role,'front_desk'::app_role]));