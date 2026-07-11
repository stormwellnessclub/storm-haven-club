
-- 1) Tighten guest_feedback INSERT: require the guest pass to have been used
--    (checked in) and enforce one feedback per pass, so anonymous submissions
--    cannot be forged for arbitrary passes.
DROP POLICY IF EXISTS "Anyone can submit feedback with token" ON public.guest_feedback;

CREATE POLICY "Anyone can submit feedback for used pass"
ON public.guest_feedback
FOR INSERT
WITH CHECK (
  guest_pass_id IS NOT NULL
  AND feedback_token IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.guest_passes gp
    WHERE gp.id = guest_feedback.guest_pass_id
      AND gp.used_at IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.guest_feedback existing
    WHERE existing.guest_pass_id = guest_feedback.guest_pass_id
  )
);

-- 2) Narrow member_credits SELECT: keep the member-facing policy scoped to
--    members themselves; move operational staff role access into a separate
--    policy limited to roles that actually need credit visibility.
DROP POLICY IF EXISTS "Members can view own credits" ON public.member_credits;
DROP POLICY IF EXISTS "Staff can view all credits" ON public.member_credits;

CREATE POLICY "Members can view own credits"
ON public.member_credits
FOR SELECT
USING (
  user_id = auth.uid()
  OR member_id IN (
    SELECT members.id FROM public.members WHERE members.user_id = auth.uid()
  )
);

CREATE POLICY "Staff can view member credits"
ON public.member_credits
FOR SELECT
USING (
  has_any_role(
    auth.uid(),
    ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]
  )
);

-- 3) spa_service_requests SELECT: align role list with the rest of the app.
DROP POLICY IF EXISTS "Admins can read service requests" ON public.spa_service_requests;

CREATE POLICY "Staff can read service requests"
ON public.spa_service_requests
FOR SELECT
USING (
  has_any_role(
    auth.uid(),
    ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'spa_staff'::app_role, 'front_desk'::app_role]
  )
);
