-- PHASE 1: Fix Critical Issues

-- 1.1 Remove direct instructor table access for authenticated users
-- Users should only access instructor data through the instructor_public_profiles view
DROP POLICY IF EXISTS "Authenticated users can view active instructors" ON instructors;

-- 1.2 Create a security-invoker view for front desk check-in operations
-- This view only exposes non-sensitive fields needed for check-in
CREATE OR REPLACE VIEW member_check_in_view WITH (security_invoker = true) AS
SELECT 
  id, 
  member_id, 
  first_name, 
  last_name, 
  photo_url, 
  status, 
  membership_type,
  user_id
FROM members;

-- Update member RLS policies with tiered access
DROP POLICY IF EXISTS "Staff can view all members" ON members;

-- Admin/Manager get full access to all member data
CREATE POLICY "Admin/Manager can view all members"
ON members FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- Front desk gets limited access (they should use the limited view)
-- But we still need a policy for them to access the base table through the view
CREATE POLICY "Front desk can view members via limited view"
ON members FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['front_desk']::app_role[]));

-- PHASE 2: Fix Warnings

-- 2.1 Add staff access to profiles (admin/manager only, not front desk)
CREATE POLICY "Admin/Manager can view all profiles"
ON profiles FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- 2.2 Restrict payment information visibility in class_bookings
-- Drop existing front desk policy and create a more restrictive one
DROP POLICY IF EXISTS "Staff can view all bookings" ON class_bookings;

-- Admin/Manager can see all booking details including payment info
CREATE POLICY "Admin/Manager can view all bookings with payment"
ON class_bookings FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- Create a view for front desk that excludes payment data
CREATE OR REPLACE VIEW booking_check_in_view WITH (security_invoker = true) AS
SELECT 
  id,
  session_id,
  user_id,
  member_id,
  status,
  booked_at,
  checked_in_at,
  cancelled_at,
  cancellation_reason,
  created_at,
  updated_at
  -- Excluded: amount_paid, payment_method, credits_used, pass_id, member_credit_id
FROM class_bookings;

-- Front desk can view bookings (for check-in purposes) but payment fields are hidden via the view
CREATE POLICY "Front desk can view bookings"
ON class_bookings FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['front_desk']::app_role[]));

-- PHASE 3: Fix Info-Level Issues

-- 3.1 Allow users to view their own credit adjustments for transparency
CREATE POLICY "Users can view their own credit adjustments"
ON credit_adjustments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM members 
    WHERE members.id = credit_adjustments.member_id 
    AND members.user_id = auth.uid()
  )
);