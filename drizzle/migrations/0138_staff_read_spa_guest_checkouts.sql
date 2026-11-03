GRANT SELECT ON public.spa_guest_checkouts TO authenticated;
ALTER TABLE public.spa_guest_checkouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view online spa checkouts" ON public.spa_guest_checkouts
FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk','spa_staff']::public.app_role[]));