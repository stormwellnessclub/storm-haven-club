ALTER TABLE public.events ADD COLUMN IF NOT EXISTS rsvp_closes_at timestamptz;
UPDATE public.events SET rsvp_closes_at = ('2026-11-28 23:59:59'::timestamp AT TIME ZONE 'America/Detroit') WHERE id = '5b4fd70a-84ef-4993-8ba5-d5d7c084386b';

CREATE OR REPLACE FUNCTION public.society_rsvp_enforce_close()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_close timestamptz;
BEGIN
  IF auth.uid() IS NULL OR public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]) THEN
    RETURN NEW;
  END IF;
  SELECT rsvp_closes_at INTO v_close FROM events WHERE id = NEW.event_id;
  IF v_close IS NOT NULL AND now() > v_close THEN
    RAISE EXCEPTION 'RSVPs are closed for this gathering';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_society_rsvp_enforce_close ON public.society_meeting_rsvps;
CREATE TRIGGER trg_society_rsvp_enforce_close BEFORE INSERT OR UPDATE ON public.society_meeting_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.society_rsvp_enforce_close();