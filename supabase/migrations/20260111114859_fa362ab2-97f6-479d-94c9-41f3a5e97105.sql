-- ===========================================
-- SECURITY REMEDIATION MIGRATION
-- ===========================================

-- 1. FIX INSTRUCTOR CONTACT INFORMATION EXPOSURE
-- Drop overly permissive policy that exposes email/phone to all authenticated users
DROP POLICY IF EXISTS "Authenticated users can view active instructors" ON public.instructors;

-- Create stricter policy - only staff roles can access the full instructors table
CREATE POLICY "Staff can view all instructors"
  ON public.instructors
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin', 'manager', 'front_desk')
    )
  );

-- 2. FIX CLASS SESSIONS PUBLIC ACCESS
-- Drop the overly permissive policy that allows unauthenticated scraping
DROP POLICY IF EXISTS "Anyone can view class sessions" ON public.class_sessions;

-- Create policy requiring authentication to view class schedules
CREATE POLICY "Authenticated users can view class sessions"
  ON public.class_sessions
  FOR SELECT
  TO authenticated
  USING (true);

-- Also allow anon to view only upcoming sessions for public schedule pages
CREATE POLICY "Public can view upcoming class sessions"
  ON public.class_sessions
  FOR SELECT
  TO anon
  USING (session_date >= CURRENT_DATE);

-- 3. SECURE VIEWS - Update to use security_invoker
-- Recreate views with security_invoker = true to inherit RLS from underlying tables

-- Drop and recreate booking_check_in_view with security_invoker
DROP VIEW IF EXISTS public.booking_check_in_view;
CREATE VIEW public.booking_check_in_view 
WITH (security_invoker = true) AS
SELECT 
  id,
  session_id,
  user_id,
  member_id,
  status,
  booked_at,
  cancelled_at,
  cancellation_reason,
  checked_in_at,
  created_at,
  updated_at
FROM public.class_bookings;

-- Drop and recreate member_check_in_view with security_invoker
DROP VIEW IF EXISTS public.member_check_in_view;
CREATE VIEW public.member_check_in_view
WITH (security_invoker = true) AS
SELECT 
  id,
  member_id,
  first_name,
  last_name,
  email,
  phone,
  photo_url,
  status,
  membership_type,
  gender
FROM public.members;

-- 4. STRENGTHEN PROFILES TABLE PROTECTION
-- Ensure profiles cannot be accessed by anonymous users
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. ADD user_id COLUMN TO MEMBERSHIP_APPLICATIONS for better security matching
ALTER TABLE public.membership_applications 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Update the applications SELECT policy to prefer user_id when available
DROP POLICY IF EXISTS "Users can view their own applications by email" ON public.membership_applications;

CREATE POLICY "Users can view their own applications"
  ON public.membership_applications
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR (user_id IS NULL AND email = current_user_email())
  );

-- 6. VERIFY MEMBERS TABLE HAS PROPER RLS (already has strict policies, just confirming)
-- The existing policies should restrict access to staff only for sensitive fields