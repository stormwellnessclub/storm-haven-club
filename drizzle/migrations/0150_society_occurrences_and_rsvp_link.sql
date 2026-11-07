ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS series_key text,
  ADD COLUMN IF NOT EXISTS round_key text,
  ADD COLUMN IF NOT EXISTS round_state text,
  ADD COLUMN IF NOT EXISTS email_image_url text,
  ADD COLUMN IF NOT EXISTS mobile_image_url text,
  ADD COLUMN IF NOT EXISTS image_alt text,
  ADD COLUMN IF NOT EXISTS email_image_position text DEFAULT 'center',
  ADD COLUMN IF NOT EXISTS email_layout text DEFAULT 'auto';
ALTER TABLE public.ritual_collections ADD COLUMN IF NOT EXISTS email_image_url text;
CREATE UNIQUE INDEX IF NOT EXISTS events_series_round_uidx ON public.events(series_key, round_key) WHERE series_key IS NOT NULL;

ALTER TABLE public.society_meeting_rsvps
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz;
ALTER TABLE public.society_meeting_rsvps DROP CONSTRAINT society_meeting_rsvps_response_check;
ALTER TABLE public.society_meeting_rsvps ADD CONSTRAINT society_meeting_rsvps_response_check CHECK (response IN ('yes','maybe','no','dismissed'));
CREATE UNIQUE INDEX IF NOT EXISTS society_rsvps_event_user_uidx ON public.society_meeting_rsvps(event_id, user_id);

CREATE OR REPLACE FUNCTION public.society_rsvp_link_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.event_id IS NULL THEN
    SELECT id INTO NEW.event_id FROM public.events WHERE series_key='higher-self-society' AND round_key=NEW.round_key;
  ELSIF NEW.round_key IS NULL THEN
    SELECT round_key INTO NEW.round_key FROM public.events WHERE id=NEW.event_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS society_rsvp_link_event ON public.society_meeting_rsvps;
CREATE TRIGGER society_rsvp_link_event BEFORE INSERT OR UPDATE ON public.society_meeting_rsvps
FOR EACH ROW EXECUTE FUNCTION public.society_rsvp_link_event();