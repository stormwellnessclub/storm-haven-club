CREATE TABLE public.body_roller_presale_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  member_id uuid,
  customer_email text NOT NULL,
  customer_name text,
  option_key text NOT NULL,
  label text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes IN (30,60)),
  sessions_total integer NOT NULL,
  sessions_used integer NOT NULL DEFAULT 0,
  subtotal_cents integer NOT NULL,
  tax_cents integer NOT NULL DEFAULT 0,
  fee_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded','cancelled')),
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.body_roller_presale_purchases TO authenticated;
GRANT ALL ON public.body_roller_presale_purchases TO service_role;
ALTER TABLE public.body_roller_presale_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own presale purchases" ON public.body_roller_presale_purchases FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Staff view presale purchases" ON public.body_roller_presale_purchases FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));

CREATE TABLE public.body_roller_presale_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ends_at timestamptz NOT NULL,
  booking_open boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.body_roller_presale_settings TO anon, authenticated;
GRANT UPDATE ON public.body_roller_presale_settings TO authenticated;
GRANT ALL ON public.body_roller_presale_settings TO service_role;
ALTER TABLE public.body_roller_presale_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads presale settings" ON public.body_roller_presale_settings FOR SELECT USING (true);
CREATE POLICY "Admins update presale settings" ON public.body_roller_presale_settings FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));
INSERT INTO public.body_roller_presale_settings (id, ends_at) VALUES (1, '2026-11-12 04:59:59+00');