
-- Fix RLS on member_credits so members can see records even when user_id is NULL
-- (common for manually imported credit records)

DROP POLICY IF EXISTS "Members can view own credits" ON member_credits;
DROP POLICY IF EXISTS "Members can view their own credits" ON member_credits;

CREATE POLICY "Members can view own credits"
ON member_credits FOR SELECT
USING (
  -- Staff can see all
  has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk','cafe_staff','spa_staff','childcare_staff','class_instructor']::app_role[])
  OR
  -- Member can see if user_id matches directly
  user_id = auth.uid()
  OR
  -- Member can see via member_id lookup (handles NULL user_id on credit records)
  member_id IN (
    SELECT id FROM members WHERE user_id = auth.uid()
  )
);
