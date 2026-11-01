CREATE OR REPLACE FUNCTION public.can_self_join_society_next_round()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.members m
   WHERE (m.user_id = auth.uid() OR lower(m.email) = public.current_user_email_lower())
     AND m.status IN ('active','frozen','past_due')
 );
$$;
REVOKE ALL ON FUNCTION public.can_self_join_society_next_round() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_self_join_society_next_round() TO authenticated, service_role;
DROP POLICY IF EXISTS "Anyone can join next round" ON public.society_next_round_interest;
CREATE POLICY "Members can join next round" ON public.society_next_round_interest
FOR INSERT TO authenticated
WITH CHECK (
 public.can_self_join_society_next_round()
 AND user_id = auth.uid()
 AND lower(trim(email)) = public.current_user_email_lower()
 AND length(trim(full_name)) BETWEEN 1 AND 120
 AND length(email) <= 255
 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
 AND now() <= TIMESTAMPTZ '2026-11-16 04:59:59+00'
);
REVOKE INSERT ON public.society_next_round_interest FROM anon;
GRANT INSERT ON public.society_next_round_interest TO authenticated;
GRANT ALL ON public.society_next_round_interest TO service_role;