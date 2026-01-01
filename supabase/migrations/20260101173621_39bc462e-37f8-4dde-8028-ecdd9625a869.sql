-- Allow members to activate their own membership (pending_activation -> active)
CREATE POLICY "Members can activate their membership"
ON public.members
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND status = 'pending_activation'
)
WITH CHECK (
  auth.uid() = user_id
  AND status = 'active'
  AND activated_at IS NOT NULL
  AND membership_start_date >= CURRENT_DATE
  AND (
    activation_deadline IS NULL
    OR membership_start_date <= (activation_deadline::date)
  )
);