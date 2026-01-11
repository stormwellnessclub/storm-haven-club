-- Configure Scheduled Functions (pg_cron jobs) - Using Configuration Table
-- Creates cron jobs for all scheduled edge functions
-- Note: Uses pg_net to call edge functions via HTTP
--
-- IMPORTANT: This migration requires the scheduled_functions_config table to be created first
-- Run migration 20260108000003_scheduled_functions_config.sql first
--
-- The configuration table stores the Supabase URL and anon key needed for authentication
-- This approach works with Supabase managed instances (no superuser privileges required)

-- Drop existing cron jobs if they exist (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname IN (
    'process-monthly-credits',
    'process-freeze-expirations',
    'send-class-reminders',
    'process-expired-waitlist',
    'process-activation-reminders'
  );
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors if jobs don't exist
  NULL;
END $$;

-- Schedule process-monthly-credits: Daily at 2 AM
-- This function processes monthly credit allocation for members
SELECT cron.schedule(
  'process-monthly-credits',
  '0 2 * * *', -- 2 AM every day (UTC)
  $$
  SELECT net.http_post(
    url := (SELECT supabase_url FROM public.get_scheduled_functions_config()) || '/functions/v1/process-monthly-credits',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT anon_key FROM public.get_scheduled_functions_config()),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Schedule process-freeze-expirations: Daily at 3 AM
-- This function processes expired membership freezes and reactivates members
SELECT cron.schedule(
  'process-freeze-expirations',
  '0 3 * * *', -- 3 AM every day (UTC)
  $$
  SELECT net.http_post(
    url := (SELECT supabase_url FROM public.get_scheduled_functions_config()) || '/functions/v1/process-freeze-expirations',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT anon_key FROM public.get_scheduled_functions_config()),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Schedule send-class-reminders: Daily at 6 AM
-- This function sends reminder emails for classes starting in 23-25 hours
SELECT cron.schedule(
  'send-class-reminders',
  '0 6 * * *', -- 6 AM every day (UTC)
  $$
  SELECT net.http_post(
    url := (SELECT supabase_url FROM public.get_scheduled_functions_config()) || '/functions/v1/send-class-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT anon_key FROM public.get_scheduled_functions_config()),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Schedule process-expired-waitlist: Daily at 1 AM
-- This function processes expired waitlist entries
SELECT cron.schedule(
  'process-expired-waitlist',
  '0 1 * * *', -- 1 AM every day (UTC)
  $$
  SELECT net.http_post(
    url := (SELECT supabase_url FROM public.get_scheduled_functions_config()) || '/functions/v1/process-expired-waitlist',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT anon_key FROM public.get_scheduled_functions_config()),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Schedule process-activation-reminders: Daily at 4 AM
-- This function sends activation reminders to approved members
SELECT cron.schedule(
  'process-activation-reminders',
  '0 4 * * *', -- 4 AM every day (UTC)
  $$
  SELECT net.http_post(
    url := (SELECT supabase_url FROM public.get_scheduled_functions_config()) || '/functions/v1/process-activation-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT anon_key FROM public.get_scheduled_functions_config()),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- View scheduled jobs:
-- SELECT * FROM cron.job ORDER BY jobname;
