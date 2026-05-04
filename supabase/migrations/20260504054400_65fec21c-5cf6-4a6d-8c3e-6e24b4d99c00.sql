ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sms_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_opt_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS sms_opt_in_source text,
  ADD COLUMN IF NOT EXISTS sms_opt_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS sms_opt_out_source text;

ALTER TABLE public.non_member_profiles
  ADD COLUMN IF NOT EXISTS sms_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_opt_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS sms_opt_in_source text,
  ADD COLUMN IF NOT EXISTS sms_opt_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS sms_opt_out_source text;

CREATE TABLE IF NOT EXISTS public.sms_consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  phone text,
  action text NOT NULL,
  source text NOT NULL,
  ip_address text,
  user_agent text,
  disclosure_version text NOT NULL DEFAULT 'v1',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_consent_log_user ON public.sms_consent_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_consent_log_phone ON public.sms_consent_log(phone);
CREATE INDEX IF NOT EXISTS idx_sms_consent_log_created ON public.sms_consent_log(created_at DESC);

ALTER TABLE public.sms_consent_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.validate_sms_consent_log()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.action NOT IN ('opt_in', 'opt_out') THEN
    RAISE EXCEPTION 'Invalid action: must be opt_in or opt_out';
  END IF;
  IF NEW.source IS NULL OR length(NEW.source) = 0 THEN
    RAISE EXCEPTION 'Source is required';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_sms_consent_log_trigger ON public.sms_consent_log;
CREATE TRIGGER validate_sms_consent_log_trigger
  BEFORE INSERT OR UPDATE ON public.sms_consent_log
  FOR EACH ROW EXECUTE FUNCTION public.validate_sms_consent_log();

DROP POLICY IF EXISTS "Users view own sms consent log" ON public.sms_consent_log;
CREATE POLICY "Users view own sms consent log"
  ON public.sms_consent_log FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all sms consent log" ON public.sms_consent_log;
CREATE POLICY "Admins view all sms consent log"
  ON public.sms_consent_log FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));

DROP POLICY IF EXISTS "Users insert own sms consent log" ON public.sms_consent_log;
CREATE POLICY "Users insert own sms consent log"
  ON public.sms_consent_log FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Admins insert sms consent log" ON public.sms_consent_log;
CREATE POLICY "Admins insert sms consent log"
  ON public.sms_consent_log FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));