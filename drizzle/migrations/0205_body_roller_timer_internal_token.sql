CREATE OR REPLACE FUNCTION public.arm_body_roller_send(_id uuid, _send_at timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE t timestamptz := _send_at AT TIME ZONE 'UTC';
BEGIN
  PERFORM cron.schedule('br-send-' || _id::text,
    format('%s %s %s %s *', extract(minute from t)::int, extract(hour from t)::int, extract(day from t)::int, extract(month from t)::int),
    $c$select net.http_post(url:='https://cqzmrdzwgsujgbjqpoxh.supabase.co/functions/v1/run-body-roller-scheduled', headers:=jsonb_build_object('Content-Type','application/json','x-internal-token',public.internal_task_token()), body:='{}'::jsonb, timeout_milliseconds:=300000);$c$);
END $function$;