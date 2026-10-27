ALTER TABLE public.spa_service_availability ADD COLUMN starts_on date;
COMMENT ON COLUMN public.spa_service_availability.starts_on IS 'Earliest Detroit appointment date for this availability window; null means no launch restriction.';
CREATE OR REPLACE FUNCTION public.enforce_spa_availability_launch_date()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE first_date date;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.service_id IS NOT DISTINCT FROM OLD.service_id AND NEW.appointment_date IS NOT DISTINCT FROM OLD.appointment_date THEN RETURN NEW; END IF;
  END IF;
  SELECT CASE WHEN bool_or(a.starts_on IS NULL) THEN NULL ELSE min(a.starts_on) END INTO first_date
  FROM public.spa_service_availability a WHERE a.service_id = NEW.service_id AND a.is_active;
  IF first_date IS NOT NULL AND NEW.appointment_date < first_date THEN
    RAISE EXCEPTION 'This treatment is available starting %', first_date;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_spa_availability_launch_date BEFORE INSERT OR UPDATE OF service_id, appointment_date ON public.spa_appointments FOR EACH ROW EXECUTE FUNCTION public.enforce_spa_availability_launch_date();