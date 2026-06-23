
-- 1) instructors: prevent email/phone leakage via Data API by using column-level GRANTs
REVOKE SELECT ON public.instructors FROM anon, authenticated;
GRANT SELECT (id, first_name, last_name, bio, photo_url, specialties, is_active, user_id, created_at, updated_at)
  ON public.instructors TO authenticated;
GRANT SELECT (id, first_name, last_name, bio, photo_url, specialties, is_active, created_at, updated_at)
  ON public.instructors TO anon;
GRANT ALL ON public.instructors TO service_role;

-- 2) spa_therapists: prevent email / phone / hourly_rate leakage via Data API
REVOKE SELECT ON public.spa_therapists FROM anon, authenticated;
GRANT SELECT (id, full_name, bio, photo_url, specialties, is_active, created_at, updated_at)
  ON public.spa_therapists TO anon, authenticated;
GRANT ALL ON public.spa_therapists TO service_role;

-- 3) scheduled_functions_config: stop persisting the anon key in a table.
-- The get_scheduled_functions_config() RPC is the only thing cron jobs use,
-- so we keep the RPC signature but return hardcoded project values, then drop the table.
CREATE OR REPLACE FUNCTION public.get_scheduled_functions_config()
RETURNS TABLE(supabase_url TEXT, anon_key TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    'https://cqzmrdzwgsujgbjqpoxh.supabase.co'::text AS supabase_url,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxem1yZHp3Z3N1amdianFwb3hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NDA4MzksImV4cCI6MjA4MjMxNjgzOX0.kPt7tgmDQy5sQ1aDGFzi43dNYcqDE4fMDJnZ8-c2_1o'::text AS anon_key;
$$;

REVOKE ALL ON FUNCTION public.get_scheduled_functions_config() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_scheduled_functions_config() TO service_role;

DROP TABLE IF EXISTS public.scheduled_functions_config;
