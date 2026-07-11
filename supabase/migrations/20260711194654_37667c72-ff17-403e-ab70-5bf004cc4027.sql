DROP POLICY IF EXISTS "Staff can view all orders" ON public.cafe_orders;
CREATE POLICY "Staff can view all orders" ON public.cafe_orders
FOR SELECT TO public
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'cafe_staff'::app_role, 'front_desk'::app_role]));