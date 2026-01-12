
-- Fix 1: scheduled_functions_config - Add restrictive policies
-- This table contains sensitive config, only service role should access via SECURITY DEFINER function
CREATE POLICY "No public access to scheduled config"
ON public.scheduled_functions_config
FOR ALL
USING (false);

-- Fix 2: membership_applications - Replace overly permissive INSERT policy
DROP POLICY IF EXISTS "Anyone can submit an application" ON public.membership_applications;

-- Allow authenticated users to submit for themselves OR unauthenticated submissions
CREATE POLICY "Users can submit applications"
ON public.membership_applications
FOR INSERT
WITH CHECK (
  user_id IS NULL OR user_id = auth.uid()
);

-- Fix 3: ai_workouts - Replace overly permissive INSERT policy
DROP POLICY IF EXISTS "Service role can insert ai_workouts" ON public.ai_workouts;

-- Allow authenticated members to insert their own workouts
CREATE POLICY "Members can insert own ai_workouts"
ON public.ai_workouts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = ai_workouts.member_id 
    AND m.user_id = auth.uid()
  )
);
