CREATE TABLE public.kids_care_pass_end_notices (
  pass_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  ended_reason text NOT NULL,
  email_status text,
  sms_status text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.kids_care_pass_end_notices TO service_role;

ALTER TABLE public.kids_care_pass_end_notices ENABLE ROW LEVEL SECURITY;

CREATE INDEX kids_care_pass_end_notices_user_idx ON public.kids_care_pass_end_notices (user_id);

SELECT cron.schedule(
  'kids-care-pass-ended-notices-daily',
  '0 15 * * *',
  $c$select net.http_post(url:='https://cqzmrdzwgsujgbjqpoxh.supabase.co/functions/v1/process-kids-care-pass-endings', headers:=jsonb_build_object('Content-Type','application/json','x-internal-token',public.internal_task_token()), body:='{}'::jsonb, timeout_milliseconds:=120000);$c$
);