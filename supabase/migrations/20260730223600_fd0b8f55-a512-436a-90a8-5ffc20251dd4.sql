ALTER TABLE public.spa_service_requests
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS preferred_time text;

CREATE OR REPLACE FUNCTION public.enforce_ozone_request_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.service_name ILIKE '%ozone%' AND (NEW.phone IS NULL OR btrim(NEW.phone) = '') THEN
    RAISE EXCEPTION 'A phone number is required for Ozone Sauna requests';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_ozone_request_phone ON public.spa_service_requests;
CREATE TRIGGER trg_enforce_ozone_request_phone
BEFORE INSERT ON public.spa_service_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_ozone_request_phone();