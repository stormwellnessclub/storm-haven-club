-- Add DELETE RLS policy for membership_applications table
-- Allows staff (super_admin, admin, manager) to delete applications

CREATE POLICY "Staff can delete applications"
  ON public.membership_applications
  FOR DELETE
  TO public
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));