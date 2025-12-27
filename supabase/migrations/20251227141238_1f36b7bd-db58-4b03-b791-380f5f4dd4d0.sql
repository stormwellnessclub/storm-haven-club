-- Add RLS policies for staff to read membership applications
CREATE POLICY "Staff can view applications" 
ON public.membership_applications 
FOR SELECT 
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

-- Allow staff to update application status
CREATE POLICY "Staff can update applications" 
ON public.membership_applications 
FOR UPDATE 
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));
