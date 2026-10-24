CREATE OR REPLACE FUNCTION public.enforce_spa_duration_upgrade_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base public.spa_services%ROWTYPE;
  variant public.spa_services%ROWTYPE;
  family text;
  extension numeric;
  matches integer;
BEGIN
  IF NEW.duration_minutes IS NOT DISTINCT FROM OLD.duration_minutes AND NEW.service_id IS NOT DISTINCT FROM OLD.service_id THEN RETURN NEW; END IF;
  SELECT * INTO base FROM public.spa_services WHERE id::text = NEW.service_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Select a menu treatment before changing its duration.'; END IF;
  family := lower(trim(regexp_replace(regexp_replace(base.name, '\s*\(Extended\)\s*$', '', 'i'), '\s*[—–-]\s*[0-9]+\s*(min(utes)?)?\s*$', '', 'i')));
  SELECT count(*) INTO matches FROM public.spa_services s WHERE s.is_active AND s.duration_minutes = NEW.duration_minutes AND lower(coalesce(s.category,'')) = lower(coalesce(base.category,'')) AND lower(trim(regexp_replace(regexp_replace(s.name, '\s*\(Extended\)\s*$', '', 'i'), '\s*[—–-]\s*[0-9]+\s*(min(utes)?)?\s*$', '', 'i'))) = family;
  SELECT sum(coalesce((a->>'price')::numeric,0)) INTO extension FROM jsonb_array_elements(coalesce(NEW.addons,'[]'::jsonb)) a WHERE a->>'id' = 'extended-time';
  IF matches = 1 THEN
    SELECT * INTO variant FROM public.spa_services s WHERE s.is_active AND s.duration_minutes = NEW.duration_minutes AND lower(coalesce(s.category,'')) = lower(coalesce(base.category,'')) AND lower(trim(regexp_replace(regexp_replace(s.name, '\s*\(Extended\)\s*$', '', 'i'), '\s*[—–-]\s*[0-9]+\s*(min(utes)?)?\s*$', '', 'i'))) = family;
    IF NEW.payment_method IN ('credit','mothers_day_voucher') AND NEW.covered_checkout IS NULL THEN
      NEW.covered_checkout := jsonb_build_object('service_amount',coalesce(OLD.member_price,OLD.service_price,0),'amount_paid',0,'payment_method',NULL);
    END IF;
    IF extension IS NOT NULL THEN
      IF abs(coalesce(NEW.member_price,NEW.service_price,0) + extension - CASE WHEN NEW.member_price IS NOT NULL THEN coalesce(variant.member_price,variant.price) ELSE variant.price END) > 0.01 THEN
        RAISE EXCEPTION 'The upgraded treatment must match its % minute menu price.',NEW.duration_minutes;
      END IF;
    ELSE
      NEW.service_id := variant.id::text;
      NEW.service_name := variant.name;
      NEW.service_category := variant.category;
      NEW.service_price := variant.price;
      NEW.member_price := variant.member_price;
      NEW.cleanup_minutes := variant.cleanup_minutes;
    END IF;
  ELSIF NEW.duration_minutes > base.duration_minutes AND extension IS NULL THEN
    RAISE EXCEPTION 'No menu price exists for this duration. Select a priced treatment or record a priced extended-time upgrade.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_spa_duration_upgrade_price() FROM PUBLIC;
CREATE TRIGGER spa_duration_upgrade_menu_price BEFORE UPDATE OF duration_minutes, service_id ON public.spa_appointments FOR EACH ROW EXECUTE FUNCTION public.enforce_spa_duration_upgrade_price();