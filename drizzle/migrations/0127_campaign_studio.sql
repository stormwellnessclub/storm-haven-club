CREATE TABLE public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Untitled campaign',
  event_tag text NOT NULL DEFAULT 'general',
  send_email boolean NOT NULL DEFAULT true,
  send_sms boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft',
  subject text NOT NULL DEFAULT '',
  preheader text NOT NULL DEFAULT '',
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  sms_body text NOT NULL DEFAULT '',
  sms_image_url text,
  audience_key text NOT NULL DEFAULT 'active_members',
  scheduled_at timestamptz,
  sent_at timestamptz,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_campaigns_status_chk CHECK (status IN ('draft','scheduled','sending','sent','failed'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaigns TO authenticated;
GRANT ALL ON public.marketing_campaigns TO service_role;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage campaigns" ON public.marketing_campaigns FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

CREATE OR REPLACE FUNCTION public.marketing_campaigns_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER marketing_campaigns_touch BEFORE UPDATE ON public.marketing_campaigns FOR EACH ROW EXECUTE FUNCTION public.marketing_campaigns_touch();

-- One-time timer per scheduled campaign; removes itself after firing.
CREATE OR REPLACE FUNCTION public.arm_marketing_campaign(_id uuid, _send_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t timestamp := _send_at AT TIME ZONE 'UTC'; jname text := 'mkt-camp-' || _id::text;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF _send_at <= now() THEN RAISE EXCEPTION 'Pick a time in the future'; END IF;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = jname;
  PERFORM cron.schedule(jname,
    format('%s %s %s %s *', extract(minute from t)::int, extract(hour from t)::int, extract(day from t)::int, extract(month from t)::int),
    format($c$select net.http_post(url:='https://cqzmrdzwgsujgbjqpoxh.supabase.co/functions/v1/campaign-studio',
      headers:=replace('{"Content-Type": "application/json", "x-internal-token": "__T__"}','__T__',public.internal_task_token())::jsonb,
      body:='{"action":"run_scheduled","id":"%s"}'::jsonb, timeout_milliseconds:=300000);
      select cron.unschedule('%s');$c$, _id, jname));
  UPDATE public.marketing_campaigns SET status = 'scheduled', scheduled_at = _send_at, last_error = NULL WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.disarm_marketing_campaign(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mkt-camp-' || _id::text;
  UPDATE public.marketing_campaigns SET status = 'draft' WHERE id = _id AND status = 'scheduled';
END $$;

-- Every other timed send already on the calendar (older one-off senders).
CREATE OR REPLACE FUNCTION public.admin_list_scheduled_sends()
RETURNS TABLE(jobid bigint, jobname text, schedule text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  RETURN QUERY SELECT j.jobid, j.jobname::text, j.schedule::text FROM cron.job j
   WHERE j.active AND j.jobname NOT LIKE 'mkt-camp-%'
     AND (j.jobname ILIKE '%announce%' OR j.jobname ILIKE '%blast%' OR j.jobname ILIKE 'hss-%' OR j.jobname ILIKE 'sms-camp-%' OR j.jobname ILIKE '%presale%' OR j.jobname ILIKE 'body-roller-%');
END $$;

CREATE OR REPLACE FUNCTION public.admin_cancel_scheduled_send(_jobid bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_list_scheduled_sends() s WHERE s.jobid = _jobid) THEN
    RAISE EXCEPTION 'Not a scheduled send';
  END IF;
  PERFORM cron.unschedule(_jobid);
END $$;

REVOKE ALL ON FUNCTION public.arm_marketing_campaign(uuid, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.disarm_marketing_campaign(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_scheduled_sends() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_cancel_scheduled_send(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.arm_marketing_campaign(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.disarm_marketing_campaign(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_scheduled_sends() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_scheduled_send(bigint) TO authenticated;