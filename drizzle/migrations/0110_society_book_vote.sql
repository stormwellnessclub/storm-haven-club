CREATE OR REPLACE FUNCTION public.is_society_roster_member(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.higher_self_society_interest h
    WHERE (h.user_id = _uid OR lower(h.email) = public.current_user_email_lower())
      AND coalesce(h.status,'active') <> 'removed'
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_society_roster_member(uuid) TO authenticated;

CREATE POLICY "Society book vote requires roster" ON public.event_votes AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (event_slug NOT LIKE 'hss-book-%' OR public.is_society_roster_member(auth.uid()));
CREATE POLICY "Society book vote update requires roster" ON public.event_votes AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (event_slug NOT LIKE 'hss-book-%' OR public.is_society_roster_member(auth.uid()))
  WITH CHECK (event_slug NOT LIKE 'hss-book-%' OR public.is_society_roster_member(auth.uid()));

CREATE TABLE public.society_next_round_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX society_next_round_email_uq ON public.society_next_round_interest (lower(email));
GRANT INSERT ON public.society_next_round_interest TO anon, authenticated;
GRANT SELECT, DELETE ON public.society_next_round_interest TO authenticated;
GRANT ALL ON public.society_next_round_interest TO service_role;
ALTER TABLE public.society_next_round_interest ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can join next round" ON public.society_next_round_interest FOR INSERT TO anon, authenticated
  WITH CHECK (length(trim(full_name)) BETWEEN 1 AND 120 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) <= 255 AND (user_id IS NULL OR user_id = auth.uid()));
CREATE POLICY "Admins view next round" ON public.society_next_round_interest FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager']::app_role[]));
CREATE POLICY "Admins delete next round" ON public.society_next_round_interest FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));