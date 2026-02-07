-- Fix overly permissive RLS policy for guest_passes
DROP POLICY IF EXISTS "Users can view their own guest passes" ON guest_passes;

CREATE POLICY "Users can view their own guest passes" 
  ON guest_passes 
  FOR SELECT 
  USING (user_id = auth.uid());