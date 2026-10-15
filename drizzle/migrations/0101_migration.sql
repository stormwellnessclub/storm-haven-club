CREATE OR REPLACE FUNCTION public.hss_enforce_signup_close()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.source, 'self') = 'self'
     AND now() > timestamptz '2026-10-18 23:59:59 America/Detroit' THEN
    RAISE EXCEPTION 'Higher Self Society sign-ups are closed.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_hss_signup_close ON public.higher_self_society_interest;
CREATE TRIGGER trg_hss_signup_close BEFORE INSERT ON public.higher_self_society_interest
FOR EACH ROW EXECUTE FUNCTION public.hss_enforce_signup_close();