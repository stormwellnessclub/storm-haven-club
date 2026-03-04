
-- Make member_id nullable so non-members can hold wellness credits via user_id only
ALTER TABLE public.member_credits ALTER COLUMN member_id DROP NOT NULL;

-- Add RLS policy for non-members to view their own wellness credits by user_id
CREATE POLICY "Non-members can view own credits"
ON public.member_credits
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
