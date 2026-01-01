-- Allow users to view their own applications by matching their email
CREATE POLICY "Users can view their own applications by email"
ON public.membership_applications
FOR SELECT
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));