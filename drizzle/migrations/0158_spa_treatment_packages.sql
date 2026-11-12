CREATE TABLE public.spa_treatment_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key text NOT NULL,
  name text NOT NULL,
  session_count integer NOT NULL CHECK (session_count > 0),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  member_price_cents integer CHECK (member_price_cents IS NULL OR member_price_cents >= 0),
  is_recommended boolean NOT NULL DEFAULT false,
  expires_after_days integer CHECK (expires_after_days IS NULL OR expires_after_days > 0),
  payment_plan_available boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_key, session_count)
);

GRANT SELECT ON public.spa_treatment_packages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spa_treatment_packages TO authenticated;
GRANT ALL ON public.spa_treatment_packages TO service_role;

ALTER TABLE public.spa_treatment_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active spa treatment packages"
  ON public.spa_treatment_packages FOR SELECT
  USING (is_active);

CREATE POLICY "Managers can manage spa treatment packages"
  ON public.spa_treatment_packages FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));

CREATE OR REPLACE FUNCTION public.touch_spa_treatment_packages()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TRIGGER spa_treatment_packages_touch
  BEFORE UPDATE ON public.spa_treatment_packages
  FOR EACH ROW EXECUTE FUNCTION public.touch_spa_treatment_packages();

INSERT INTO public.spa_treatment_packages (service_key, name, session_count, price_cents, is_recommended, display_order) VALUES
  ('aella-sculpt', 'Single 90-Minute Treatment', 1, 35000, false, 0),
  ('aella-sculpt', 'Foundation Series', 4, 132000, false, 1),
  ('aella-sculpt', 'Aella Series', 6, 189000, true, 2),
  ('aella-sculpt', 'Extended Series', 8, 244000, false, 3),
  ('aella-sculpt', 'Extended Series', 12, 348000, false, 4);