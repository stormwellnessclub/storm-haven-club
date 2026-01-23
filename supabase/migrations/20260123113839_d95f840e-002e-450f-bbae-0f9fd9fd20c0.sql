-- Add explicit deny-all policy for processed_webhook_events
-- This satisfies the linter while maintaining the security design:
-- Service role (edge functions) bypasses RLS automatically

CREATE POLICY "No public access to webhook events"
ON public.processed_webhook_events FOR ALL
USING (false)
WITH CHECK (false);