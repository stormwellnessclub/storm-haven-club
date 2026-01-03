-- Drop existing policy that allows both admin and super_admin to delete
DROP POLICY IF EXISTS "Admins can delete members" ON public.members;

-- Create new policy for super_admin only
CREATE POLICY "Super admins can delete members"
ON public.members
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'));