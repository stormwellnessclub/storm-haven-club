-- Hourly revenue ledger sync (approved by the owner, Oct 2026).
--
-- Calls the sync-revenue-ledger edge function at 20 past every hour. The
-- service-role key is read from the vault each time the job runs, so no secret
-- is stored in this file or in the cron job definition. If the vault has no
-- 'service_role_key' secret, the call is rejected and staff can still click
-- "Sync now" on any revenue report.

DO $$
BEGIN
  PERFORM cron.unschedule('sync-revenue-ledger-hourly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-revenue-ledger-hourly');

  PERFORM cron.schedule(
    'sync-revenue-ledger-hourly',
    '20 * * * *',
    $cmd$
      SELECT net.http_post(
        url := 'https://cqzmrdzwgsujgbjqpoxh.supabase.co/functions/v1/sync-revenue-ledger',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(
            (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
            ''
          )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 150000
      );
    $cmd$
  );
END $$;
