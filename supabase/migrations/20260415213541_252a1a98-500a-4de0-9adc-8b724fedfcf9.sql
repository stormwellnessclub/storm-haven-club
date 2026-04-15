
-- Backfill user_id on orphaned admin-booked appointments
UPDATE spa_appointments sa
SET user_id = m.user_id
FROM members m
WHERE sa.member_id = m.id
  AND sa.user_id IS NULL
  AND m.user_id IS NOT NULL;

-- Drop and recreate SELECT policy to also match by member_id
DROP POLICY IF EXISTS "Users can view their own spa appointments" ON spa_appointments;
CREATE POLICY "Users can view their own spa appointments"
  ON spa_appointments FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk','spa_staff']::app_role[])
  );

-- Drop and recreate UPDATE policy to also match by member_id
DROP POLICY IF EXISTS "Users can update their own spa appointments" ON spa_appointments;
CREATE POLICY "Users can update their own spa appointments"
  ON spa_appointments FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk','spa_staff']::app_role[])
  );
