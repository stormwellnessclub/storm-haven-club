CREATE TABLE IF NOT EXISTS public.cafe_ordering_settings (
  id boolean PRIMARY KEY DEFAULT true,
  online_ordering_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT cafe_ordering_settings_singleton CHECK (id)
);

GRANT SELECT ON public.cafe_ordering_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.cafe_ordering_settings TO authenticated;
GRANT ALL ON public.cafe_ordering_settings TO service_role;

ALTER TABLE public.cafe_ordering_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read cafe ordering settings" ON public.cafe_ordering_settings;
CREATE POLICY "Anyone can read cafe ordering settings"
  ON public.cafe_ordering_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Managers can insert cafe ordering settings" ON public.cafe_ordering_settings;
CREATE POLICY "Managers can insert cafe ordering settings"
  ON public.cafe_ordering_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role]));

DROP POLICY IF EXISTS "Managers can update cafe ordering settings" ON public.cafe_ordering_settings;
CREATE POLICY "Managers can update cafe ordering settings"
  ON public.cafe_ordering_settings FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role]));

INSERT INTO public.cafe_ordering_settings (id, online_ordering_enabled)
VALUES (true, true)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enforce_cafe_online_ordering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
BEGIN
  SELECT online_ordering_enabled INTO v_enabled FROM public.cafe_ordering_settings WHERE id;
  IF COALESCE(v_enabled, true) THEN
    RETURN NEW;
  END IF;

  -- Staff (POS / front desk) can always ring up an order in person.
  IF auth.uid() IS NULL OR public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role,'front_desk'::app_role,'cafe_staff'::app_role]) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Cafe online ordering is currently closed';
END;
$$;

DROP TRIGGER IF EXISTS enforce_cafe_online_ordering_trg ON public.cafe_orders;
CREATE TRIGGER enforce_cafe_online_ordering_trg
  BEFORE INSERT ON public.cafe_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_cafe_online_ordering();