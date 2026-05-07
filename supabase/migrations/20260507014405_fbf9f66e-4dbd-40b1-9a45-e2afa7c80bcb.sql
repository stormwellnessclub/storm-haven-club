
-- 1. Activate the two confirmed-paid vouchers
UPDATE public.mothers_day_vouchers
SET status = 'active'
WHERE code IN ('MOM-QQDTAJ', 'MOM-KSWEHA')
  AND status = 'pending';

-- 2. Schedule reconcile every 5 minutes (uses service role to call the edge function)
DO $$
DECLARE
  v_url text := 'https://cqzmrdzwgsujgbjqpoxh.supabase.co/functions/v1/mothers-day-reconcile';
  v_key text;
BEGIN
  -- Drop existing job if present
  PERFORM cron.unschedule('mothers-day-reconcile-every-5min')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mothers-day-reconcile-every-5min');

  -- Service role key from vault
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF v_key IS NULL THEN
    -- fall back: just schedule with anon header; function will reject — admin can adjust
    RAISE NOTICE 'service_role_key not found in vault; cron will need manual key wire-up';
  END IF;

  PERFORM cron.schedule(
    'mothers-day-reconcile-every-5min',
    '*/5 * * * *',
    format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body := '{}'::jsonb
      );
    $cmd$, v_url, COALESCE(v_key, ''))
  );
END $$;
