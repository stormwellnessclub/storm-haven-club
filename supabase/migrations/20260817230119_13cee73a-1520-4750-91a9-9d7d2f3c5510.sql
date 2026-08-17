DELETE FROM public.member_freezes WHERE id = '945b4b6a-5130-47c6-b346-b62bb95f7beb';

SELECT cron.unschedule('process-freeze-activations-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-freeze-activations-daily');

SELECT cron.schedule(
  'process-freeze-activations-daily',
  '15 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://cqzmrdzwgsujgbjqpoxh.supabase.co/functions/v1/freeze-billing',
    headers := '{"Content-Type": "application/json", "x-internal-token": "storm-internal-3f9c1a7e42b84d5aa1c60d8e7b25f0c9"}'::jsonb,
    body := '{"action": "run_activations"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.unschedule('freeze-billing-drift-repair-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'freeze-billing-drift-repair-daily');

SELECT cron.schedule(
  'freeze-billing-drift-repair-daily',
  '45 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://cqzmrdzwgsujgbjqpoxh.supabase.co/functions/v1/freeze-billing',
    headers := '{"Content-Type": "application/json", "x-internal-token": "storm-internal-3f9c1a7e42b84d5aa1c60d8e7b25f0c9"}'::jsonb,
    body := '{"action": "repair"}'::jsonb
  ) AS request_id;
  $$
);