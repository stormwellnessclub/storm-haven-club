CREATE OR REPLACE FUNCTION public.society_rsvp_enforce_close()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_close timestamptz;
BEGIN
  IF auth.role() = 'service_role' OR public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN
    RETURN NEW;
  END IF;
  SELECT rsvp_closes_at INTO v_close FROM events WHERE id = NEW.event_id;
  IF v_close IS NOT NULL AND now() > v_close THEN
    RAISE EXCEPTION 'RSVPs are closed for this gathering';
  END IF;
  RETURN NEW;
END $$;