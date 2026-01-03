-- Allow members to view their own charges via member_id
CREATE POLICY "Members can view their own charges"
ON public.manual_charges
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM members 
    WHERE members.id = manual_charges.member_id 
    AND members.user_id = auth.uid()
  )
);