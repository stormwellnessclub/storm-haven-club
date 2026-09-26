-- Members may no longer flip their own membership to active; activation happens via payment webhooks or staff.
DROP POLICY IF EXISTS "Members can activate their membership" ON public.members;
-- Achievements are awarded only by server-side functions, never inserted directly by users.
DROP POLICY IF EXISTS "Users can create their own achievements" ON public.member_achievements;