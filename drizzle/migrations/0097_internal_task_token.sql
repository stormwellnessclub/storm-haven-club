-- Internal task token in the vault (security fix, Oct 2026).
--
-- Scheduled jobs prove they are internal by sending a token. Until now that token
-- was written in plain text inside each job definition, and one copy was committed
-- to the public GitHub repo, so anyone could call internal functions with it.
--
-- This migration:
--   1. generates a new random token inside the database and stores it in the
--      vault as 'internal_task_token' (nobody sees it; it is never in the repo);
--   2. exposes it only to the service role (edge functions) and to scheduled jobs
--      through public.internal_task_token();
--   3. rewrites every scheduled job that sends a token in plain text so it reads
--      the vault token when it runs, and switches the revenue sync, billing
--      reconciliation and membership sync jobs to the same token;
--   4. lists, by name, any job it could not convert.
--
-- Edge functions accept the vault token (see supabase/functions/_shared/internalTaskToken.ts)
-- and, until it is deleted, the old INTERNAL_TASK_TOKEN secret. Deploy the edge
-- functions BEFORE applying this migration, then delete INTERNAL_TASK_TOKEN once
-- the verification query shows no job uses the old token.

-- 1. The token
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'internal_task_token') THEN
    PERFORM vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'internal_task_token',
      'Token scheduled jobs send to internal edge functions. Generated in the database; never stored in code.'
    );
  END IF;
END $$;

-- 2. Access to it
CREATE OR REPLACE FUNCTION public.internal_task_token()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_task_token' LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.internal_task_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.internal_task_token() TO service_role;

COMMENT ON FUNCTION public.internal_task_token() IS
  'Vault-held internal task token. Service role and scheduled jobs only.';

-- 3a. Rewrite plain-text tokens in existing jobs.
--     Form A: headers as a JSON text literal, e.g.
--       '{"Content-Type": "application/json", "x-internal-token": "<token>"}'::jsonb
--     becomes replace('{... "x-internal-token": "__VAULT__"}', '__VAULT__', public.internal_task_token())::jsonb
--     Form B: jsonb_build_object(..., 'x-internal-token', '<token>')
--     becomes jsonb_build_object(..., 'x-internal-token', public.internal_task_token())
--     The membership sync job's 'x-cron-secret' header is converted the same way;
--     sync-membership-truth accepts the vault token in that header.
DO $$
DECLARE
  r record;
  v_new text;
  v_converted text[] := '{}';
BEGIN
  FOR r IN SELECT jobid, jobname, command FROM cron.job LOOP
    v_new := regexp_replace(
      r.command,
      $re$'(\{[^']*"(x-internal-task-token|x-internal-token|x-cron-secret)"\s*:\s*")[^"]*("[^']*\})'(\s*::\s*jsonb)$re$,
      $rep$replace('\1__VAULT_INTERNAL_TASK_TOKEN__\3', '__VAULT_INTERNAL_TASK_TOKEN__', public.internal_task_token())\4$rep$,
      'g'
    );
    v_new := regexp_replace(
      v_new,
      $re$('(x-internal-task-token|x-internal-token|x-cron-secret)'\s*,\s*)'[^']*'$re$,
      $rep$\1public.internal_task_token()$rep$,
      'g'
    );
    IF v_new IS DISTINCT FROM r.command THEN
      PERFORM cron.alter_job(r.jobid, command := v_new);
      v_converted := v_converted || r.jobname;
    END IF;
  END LOOP;
  RAISE NOTICE 'Jobs switched to the vault token: %', v_converted;
END $$;

-- 3b. The jobs added for the revenue ledger and billing reconciliation used the
--     service-role key, which is not available in this project. Re-create them
--     with the vault token.
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
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-task-token', public.internal_task_token()),
        body := '{}'::jsonb,
        timeout_milliseconds := 150000
      );
    $cmd$
  );

  PERFORM cron.unschedule('reconcile-billing-nightly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-billing-nightly');
  PERFORM cron.schedule(
    'reconcile-billing-nightly',
    '15 8 * * *',
    $cmd$
      SELECT net.http_post(
        url := 'https://cqzmrdzwgsujgbjqpoxh.supabase.co/functions/v1/reconcile-billing',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-task-token', public.internal_task_token()),
        body := '{"trigger": "scheduled"}'::jsonb,
        timeout_milliseconds := 150000
      );
    $cmd$
  );
END $$;

-- 4. Anything still carrying a plain-text token is reported by name.
DO $$
DECLARE
  v_left text[];
BEGIN
  SELECT array_agg(jobname ORDER BY jobname) INTO v_left
  FROM cron.job
  WHERE command ~ '(x-internal-task-token|x-internal-token|x-cron-secret)'
    AND command !~ 'internal_task_token\(\)';
  IF v_left IS NOT NULL THEN
    RAISE WARNING 'These jobs still send a plain-text token and were NOT converted: %', v_left;
  END IF;
END $$;
