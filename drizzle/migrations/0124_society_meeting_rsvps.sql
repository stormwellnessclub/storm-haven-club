CREATE TABLE public.society_meeting_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_key text NOT NULL,
  user_id uuid NOT NULL,
  response text NOT NULL CHECK (response IN ('yes','maybe','no')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_key, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.society_meeting_rsvps TO authenticated;
GRANT ALL ON public.society_meeting_rsvps TO service_role;
ALTER TABLE public.society_meeting_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own RSVP read" ON public.society_meeting_rsvps FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::public.app_role[]));
CREATE POLICY "Roster RSVP insert" ON public.society_meeting_rsvps FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_society_roster_member(auth.uid()));
CREATE POLICY "Roster RSVP update" ON public.society_meeting_rsvps FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.is_society_roster_member(auth.uid()));
CREATE TRIGGER society_meeting_rsvps_touch BEFORE UPDATE ON public.society_meeting_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();