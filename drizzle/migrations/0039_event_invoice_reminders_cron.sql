SELECT cron.unschedule('process-event-invoice-reminders-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-event-invoice-reminders-daily');

SELECT cron.schedule(
  'process-event-invoice-reminders-daily',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url := 'https://cqzmrdzwgsujgbjqpoxh.supabase.co/functions/v1/process-event-invoice-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
