
CREATE TABLE public.event_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_slug text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_key text NOT NULL,
  voter_type text NOT NULL DEFAULT 'member' CHECK (voter_type IN ('member','non_member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_slug, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_votes TO authenticated;
GRANT ALL ON public.event_votes TO service_role;

ALTER TABLE public.event_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own vote"
  ON public.event_votes FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));

CREATE POLICY "Users insert their own vote"
  ON public.event_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own vote"
  ON public.event_votes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins delete votes"
  ON public.event_votes FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));

CREATE TRIGGER event_votes_touch_updated
  BEFORE UPDATE ON public.event_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE VIEW public.event_vote_tallies
  WITH (security_invoker = on) AS
SELECT
  event_slug,
  option_key,
  COUNT(*)::int AS vote_count,
  SUM(COUNT(*)) OVER (PARTITION BY event_slug)::int AS total_votes,
  ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (PARTITION BY event_slug), 0), 1) AS percentage
FROM public.event_votes
GROUP BY event_slug, option_key;

GRANT SELECT ON public.event_vote_tallies TO authenticated, anon;
