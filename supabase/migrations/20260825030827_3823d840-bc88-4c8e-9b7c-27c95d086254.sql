GRANT SELECT, INSERT, UPDATE, DELETE ON public.spa_therapists TO authenticated;
GRANT ALL ON public.spa_therapists TO service_role;
REVOKE ALL ON public.spa_therapists FROM anon;