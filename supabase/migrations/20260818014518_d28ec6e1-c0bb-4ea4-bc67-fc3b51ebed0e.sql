CREATE TABLE public.application_submit_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  first_name text,
  last_name text,
  email text,
  phone text,
  payload jsonb,
  error_message text,
  application_id uuid,
  client_key text,
  user_agent text
);

CREATE INDEX idx_application_submit_attempts_status ON public.application_submit_attempts (status, created_at DESC);
CREATE INDEX idx_application_submit_attempts_email ON public.application_submit_attempts (lower(email));
CREATE UNIQUE INDEX idx_application_submit_attempts_client_key ON public.application_submit_attempts (client_key) WHERE client_key IS NOT NULL;

GRANT SELECT ON public.application_submit_attempts TO authenticated;
GRANT ALL ON public.application_submit_attempts TO service_role;

ALTER TABLE public.application_submit_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view application submit attempts"
ON public.application_submit_attempts
FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::public.app_role[]));

CREATE TRIGGER trg_application_submit_attempts_updated_at
BEFORE UPDATE ON public.application_submit_attempts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();