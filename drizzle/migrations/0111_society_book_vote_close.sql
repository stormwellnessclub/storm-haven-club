DROP POLICY "Society book vote requires roster" ON public.event_votes;
DROP POLICY "Society book vote update requires roster" ON public.event_votes;
CREATE POLICY "Society book vote requires roster" ON public.event_votes AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (event_slug NOT LIKE 'hss-book-%' OR (public.is_society_roster_member(auth.uid()) AND now() < '2026-10-24T03:59:59Z'::timestamptz));
CREATE POLICY "Society book vote update requires roster" ON public.event_votes AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (event_slug NOT LIKE 'hss-book-%' OR (public.is_society_roster_member(auth.uid()) AND now() < '2026-10-24T03:59:59Z'::timestamptz))
  WITH CHECK (event_slug NOT LIKE 'hss-book-%' OR (public.is_society_roster_member(auth.uid()) AND now() < '2026-10-24T03:59:59Z'::timestamptz));