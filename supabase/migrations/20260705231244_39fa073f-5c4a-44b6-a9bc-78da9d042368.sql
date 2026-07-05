
-- Tighten guest_feedback insert to require a valid guest_pass_id
DROP POLICY IF EXISTS "Anyone can submit feedback with token" ON public.guest_feedback;
CREATE POLICY "Anyone can submit feedback with token"
  ON public.guest_feedback
  FOR INSERT
  WITH CHECK (
    guest_pass_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.guest_passes gp WHERE gp.id = guest_feedback.guest_pass_id)
  );

-- Kids Care interest waitlist: bind to caller identity
DROP POLICY IF EXISTS "Anyone can join interest waitlist" ON public.kids_care_interest_waitlist;
CREATE POLICY "Anyone can join interest waitlist"
  ON public.kids_care_interest_waitlist
  FOR INSERT
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()))
  );

-- Merch orders: keep insert but require anonymous rows to have null user_id (already enforced).
-- No change needed - existing policy already enforces the pattern. Reaffirm to make intent explicit.
DROP POLICY IF EXISTS "Anyone can create merch orders" ON public.merch_orders;
CREATE POLICY "Anyone can create merch orders"
  ON public.merch_orders
  FOR INSERT
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR user_id IS NULL))
  );

-- SMS consent log: anon branch must set user_id NULL
DROP POLICY IF EXISTS "Users insert own sms consent log" ON public.sms_consent_log;
CREATE POLICY "Users insert own sms consent log"
  ON public.sms_consent_log
  FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR (auth.uid() IS NULL AND user_id IS NULL)
  );
