-- Create case-insensitive email helper function
CREATE OR REPLACE FUNCTION public.current_user_email_lower()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT LOWER(email) FROM auth.users WHERE id = auth.uid()
$$;

-- Drop the old case-sensitive policy
DROP POLICY IF EXISTS "Users can view their own applications" ON public.membership_applications;

-- Create new policy with case-insensitive email matching
CREATE POLICY "Users can view their own applications"
ON public.membership_applications
FOR SELECT
USING (
  (auth.uid() = user_id) 
  OR (
    (user_id IS NULL) 
    AND (LOWER(email) = current_user_email_lower())
  )
);