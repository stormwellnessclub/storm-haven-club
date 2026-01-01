-- Add RLS policy for members to view their own record
CREATE POLICY "Members can view their own record"
ON public.members
FOR SELECT
USING (auth.uid() = user_id);