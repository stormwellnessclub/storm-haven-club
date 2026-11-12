CREATE TABLE public.spa_treatment_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key text NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX spa_treatment_zones_service_name_key ON public.spa_treatment_zones (service_key, lower(name));

GRANT SELECT ON public.spa_treatment_zones TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spa_treatment_zones TO authenticated;
GRANT ALL ON public.spa_treatment_zones TO service_role;

ALTER TABLE public.spa_treatment_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active spa treatment zones"
  ON public.spa_treatment_zones FOR SELECT
  USING (is_active);

CREATE POLICY "Managers can manage spa treatment zones"
  ON public.spa_treatment_zones FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));

CREATE TRIGGER spa_treatment_zones_touch
  BEFORE UPDATE ON public.spa_treatment_zones
  FOR EACH ROW EXECUTE FUNCTION public.touch_spa_treatment_packages();

-- One zone per appointment: a single zone reference plus the name as booked.
ALTER TABLE public.spa_appointments
  ADD COLUMN treatment_zone_id uuid REFERENCES public.spa_treatment_zones(id) ON DELETE SET NULL,
  ADD COLUMN treatment_zone_name text;

-- Fill the zone name from the zone record so schedules always show what was booked.
CREATE OR REPLACE FUNCTION public.set_spa_appointment_zone_name()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE z public.spa_treatment_zones;
BEGIN
  IF NEW.treatment_zone_id IS NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.treatment_zone_id IS NOT NULL THEN NEW.treatment_zone_name := NULL; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.treatment_zone_id IS NOT DISTINCT FROM OLD.treatment_zone_id THEN RETURN NEW; END IF;
  SELECT * INTO z FROM public.spa_treatment_zones WHERE id = NEW.treatment_zone_id;
  IF NOT FOUND OR NOT z.is_active THEN
    RAISE EXCEPTION 'That treatment zone is not available. Please choose another.';
  END IF;
  NEW.treatment_zone_name := z.name;
  RETURN NEW;
END $$;

CREATE TRIGGER spa_appointments_zone_name
  BEFORE INSERT OR UPDATE OF treatment_zone_id ON public.spa_appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_spa_appointment_zone_name();

INSERT INTO public.spa_treatment_zones (service_key, name, description, display_order) VALUES
  ('aella-sculpt', 'Abdomen + Waist', 'Focused treatment of the abdomen and waistline.', 0),
  ('aella-sculpt', 'Flanks + Lower Back', 'Focused treatment of the sides of the waist and lower-back area.', 1),
  ('aella-sculpt', 'Upper Back / Bra Line', 'Focused treatment of the upper-back and bra-line area.', 2),
  ('aella-sculpt', 'Arms — Both', 'Treatment includes both upper arms as one treatment zone.', 3),
  ('aella-sculpt', 'Front Thighs — Both', 'Treatment includes the front of both thighs. The provider may tailor additional attention toward the inner or outer thigh depending on the client''s contouring goals.', 4),
  ('aella-sculpt', 'Back Thighs — Both', 'Treatment includes the back of both thighs/hamstring area. The provider may tailor the treatment according to the client''s individual contouring goals.', 5),
  ('aella-sculpt', 'Glutes', 'Focused treatment of the gluteal area.', 6);