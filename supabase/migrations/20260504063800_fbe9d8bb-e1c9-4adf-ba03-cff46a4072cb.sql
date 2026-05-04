
ALTER TYPE sms_status ADD VALUE IF NOT EXISTS 'received';
ALTER TYPE sms_status ADD VALUE IF NOT EXISTS 'blocked_no_consent';

ALTER TABLE public.sms_messages
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound','inbound')),
  ADD COLUMN IF NOT EXISTS recipient_user_id uuid NULL,
  ADD COLUMN IF NOT EXISTS template_key text NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key text NULL,
  ADD COLUMN IF NOT EXISTS error_code text NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS sms_messages_idempotency_key_uniq
  ON public.sms_messages (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS sms_messages_recipient_user_idx ON public.sms_messages (recipient_user_id);
CREATE INDEX IF NOT EXISTS sms_messages_phone_idx ON public.sms_messages (phone);
CREATE INDEX IF NOT EXISTS sms_messages_template_key_idx ON public.sms_messages (template_key);
CREATE INDEX IF NOT EXISTS sms_messages_created_at_idx ON public.sms_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS sms_messages_twilio_sid_idx ON public.sms_messages (twilio_sid);

ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='sms_messages'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.sms_messages', r.policyname);
  END LOOP;
END$$;

CREATE POLICY "Admins read all sms_messages"
ON public.sms_messages FOR SELECT
USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role]));

CREATE POLICY "Users read own sms_messages"
ON public.sms_messages FOR SELECT
USING (recipient_user_id = auth.uid());
