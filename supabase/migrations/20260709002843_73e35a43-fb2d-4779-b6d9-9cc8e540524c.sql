
-- =========================================================
-- class_reviews: remove public/authenticated broad SELECT that exposed user_id.
-- Public path uses SECURITY DEFINER RPC get_class_reviews_with_names.
-- Authenticated users can still see their own reviews; staff via existing ALL policy.
-- =========================================================
DROP POLICY IF EXISTS "Anon can read visible reviews" ON public.class_reviews;
DROP POLICY IF EXISTS "Anyone can read visible reviews" ON public.class_reviews;

CREATE POLICY "Users can read their own class reviews"
ON public.class_reviews
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- =========================================================
-- spa_reviews: same treatment. Drop anon SELECT and narrow authenticated SELECT
-- to own rows only. Public path uses get_spa_reviews_with_names RPC.
-- =========================================================
DROP POLICY IF EXISTS "Anon can read visible spa reviews" ON public.spa_reviews;
DROP POLICY IF EXISTS "Authenticated can read visible spa reviews" ON public.spa_reviews;

CREATE POLICY "Users can read their own spa reviews"
ON public.spa_reviews
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- =========================================================
-- gut_reset_sessions: stop exposing internal 'notes' publicly.
-- Replace the broad public policy with a public view that omits notes.
-- Admins keep full access via existing admin policies.
-- =========================================================
DROP POLICY IF EXISTS "Public can view scheduled or completed sessions" ON public.gut_reset_sessions;

CREATE OR REPLACE VIEW public.gut_reset_sessions_public
WITH (security_invoker = off) AS
SELECT
  id,
  start_date,
  length_days,
  capacity,
  spots_taken,
  status,
  created_at,
  updated_at
FROM public.gut_reset_sessions
WHERE status = ANY (ARRAY['scheduled'::text, 'completed'::text]);

GRANT SELECT ON public.gut_reset_sessions_public TO anon, authenticated;
