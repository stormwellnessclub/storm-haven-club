-- Step 1: Create a SECURITY DEFINER function to safely get current user's email
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid()
$$;

-- Step 2: Drop the problematic RLS policy that directly references auth.users
DROP POLICY IF EXISTS "Users can view their own applications by email" ON public.membership_applications;

-- Step 3: Recreate the policy using the new security definer function
CREATE POLICY "Users can view their own applications by email" 
ON public.membership_applications 
FOR SELECT 
USING (email = public.current_user_email());