CREATE TABLE public.body_roller_email_opens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  kind text NOT NULL,
  first_opened_at timestamptz NOT NULL DEFAULT now(),
  last_opened_at timestamptz NOT NULL DEFAULT now(),
  open_count integer NOT NULL DEFAULT 1,
  UNIQUE (email, kind)
);
GRANT SELECT ON public.body_roller_email_opens TO authenticated;
GRANT ALL ON public.body_roller_email_opens TO service_role;
ALTER TABLE public.body_roller_email_opens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read email opens" ON public.body_roller_email_opens FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));

CREATE OR REPLACE FUNCTION public.record_body_roller_open(_email text, _kind text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.body_roller_email_opens (email, kind) VALUES (lower(trim(_email)), _kind)
  ON CONFLICT (email, kind) DO UPDATE SET last_opened_at = now(), open_count = body_roller_email_opens.open_count + 1;
$$;
REVOKE EXECUTE ON FUNCTION public.record_body_roller_open(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_body_roller_open(text, text) TO service_role;

CREATE TABLE public.body_roller_scheduled_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  extra_emails text[] NOT NULL DEFAULT '{}',
  send_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','sending','sent','failed','cancelled')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  result jsonb,
  error text
);
GRANT SELECT ON public.body_roller_scheduled_sends TO authenticated;
GRANT ALL ON public.body_roller_scheduled_sends TO service_role;
ALTER TABLE public.body_roller_scheduled_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read scheduled sends" ON public.body_roller_scheduled_sends FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));
CREATE INDEX ON public.body_roller_scheduled_sends (status, send_at);

CREATE OR REPLACE FUNCTION public.unschedule_body_roller_send(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname = 'br-send-' || _id::text;
EXCEPTION WHEN others THEN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.unschedule_body_roller_send(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unschedule_body_roller_send(uuid) TO service_role;