GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_votes TO authenticated;
GRANT ALL ON public.event_votes TO service_role;

GRANT SELECT ON public.event_vote_tallies TO authenticated;
GRANT SELECT ON public.event_vote_tallies TO anon;
GRANT ALL ON public.event_vote_tallies TO service_role;