CREATE POLICY "Staff can view monthly credit grants" ON public.monthly_credit_grants
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role]));