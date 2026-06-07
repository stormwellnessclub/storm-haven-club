DO $$
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname = 'check-expiring-cards';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'check-expiring-cards',
  '0 13 * * *', -- 13:00 UTC = 8 AM Central (CST) / 9 AM CDT
  $$
  SELECT net.http_post(
    url := (SELECT supabase_url FROM public.get_scheduled_functions_config()) || '/functions/v1/check-expiring-cards',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT anon_key FROM public.get_scheduled_functions_config()),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);