-- Fix: Change view to use SECURITY INVOKER (the default)
-- Drop and recreate the view without SECURITY DEFINER

DROP VIEW IF EXISTS public.instructor_public_profiles;

CREATE VIEW public.instructor_public_profiles 
WITH (security_invoker = true)
AS
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

-- Grant access to the view
GRANT SELECT ON public.instructor_public_profiles TO anon, authenticated;