ALTER TABLE public.spa_service_requests
  ADD COLUMN IF NOT EXISTS requested_date date,
  ADD COLUMN IF NOT EXISTS requested_time text,
  ADD COLUMN IF NOT EXISTS alt_date date,
  ADD COLUMN IF NOT EXISTS alt_time text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS handled_by uuid,
  ADD COLUMN IF NOT EXISTS handled_at timestamptz,
  ADD COLUMN IF NOT EXISTS appointment_id uuid;
GRANT UPDATE ON public.spa_service_requests TO authenticated;
CREATE POLICY "Staff can update service requests" ON public.spa_service_requests
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','spa_staff','front_desk']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','spa_staff','front_desk']::app_role[]));
ALTER TABLE public.spa_service_requests REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.spa_service_requests;
EXCEPTION WHEN others THEN NULL; END $$;