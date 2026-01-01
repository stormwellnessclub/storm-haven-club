-- Fix instructor PII exposure: Create a public view and update RLS

-- Create a view for public instructor profiles (no email/phone)
CREATE OR REPLACE VIEW public.instructor_public_profiles AS
SELECT 
  id, 
  first_name, 
  last_name, 
  bio, 
  specialties, 
  photo_url, 
  is_active,
  created_at,
  updated_at
FROM public.instructors
WHERE is_active = true;

-- Grant access to the view for authenticated and anonymous users
GRANT SELECT ON public.instructor_public_profiles TO anon, authenticated;

-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Anyone can view active instructors" ON public.instructors;

-- Create a new policy that requires authentication to view full instructor data
CREATE POLICY "Authenticated users can view active instructors" 
ON public.instructors 
FOR SELECT 
USING (
  is_active = true 
  AND auth.uid() IS NOT NULL
);

-- Strengthen membership_applications RLS policy
DROP POLICY IF EXISTS "Users can view their own applications by email" ON public.membership_applications;

CREATE POLICY "Users can view their own applications by email" 
ON public.membership_applications 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND email = current_user_email()
);