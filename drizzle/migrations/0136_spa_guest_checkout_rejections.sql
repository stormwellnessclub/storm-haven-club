CREATE TABLE public.spa_guest_checkout_rejections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  message text,
  guest_name text,
  guest_email text,
  guest_phone text,
  service_id uuid,
  appointment_date date,
  appointment_time text,
  signed_in boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.spa_guest_checkout_rejections TO authenticated;
GRANT ALL ON public.spa_guest_checkout_rejections TO service_role;
ALTER TABLE public.spa_guest_checkout_rejections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view spa checkout rejections" ON public.spa_guest_checkout_rejections
FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk','spa_staff']::public.app_role[]));
CREATE INDEX spa_guest_checkout_rejections_created_idx ON public.spa_guest_checkout_rejections (created_at DESC);