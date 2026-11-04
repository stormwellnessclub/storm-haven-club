ALTER TABLE public.spa_guest_checkouts
  ADD COLUMN IF NOT EXISTS stop_reason text,
  ADD COLUMN IF NOT EXISTS decline_message text,
  ADD COLUMN IF NOT EXISTS swept_at timestamptz;

-- One self-removing timer: fires 10 minutes after the earliest unpaid hold expires, then re-arms for the next one.
CREATE OR REPLACE FUNCTION public.arm_spa_checkout_sweep() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t timestamptz; u timestamp;
BEGIN
  PERFORM pg_advisory_xact_lock(7402917);
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='spa-checkout-sweep-next';
  SELECT min(expires_at) + interval '10 minutes' INTO t FROM public.spa_guest_checkouts
   WHERE status='pending' AND appointment_id IS NULL AND swept_at IS NULL
     AND (payment_intent_id IS NOT NULL OR setup_intent_id IS NOT NULL);
  IF t IS NULL THEN RETURN; END IF;
  t := greatest(t, now() + interval '1 minute');
  u := t AT TIME ZONE 'UTC';
  PERFORM cron.schedule('spa-checkout-sweep-next',
    format('%s %s %s %s *', extract(minute from u)::int, extract(hour from u)::int, extract(day from u)::int, extract(month from u)::int),
    $job$select cron.unschedule('spa-checkout-sweep-next'); select net.http_post(url:='https://cqzmrdzwgsujgbjqpoxh.supabase.co/functions/v1/spa-guest-checkout',headers:=jsonb_build_object('Content-Type','application/json','x-internal-token',public.internal_task_token()),body:='{"action":"sweep"}'::jsonb,timeout_milliseconds:=60000);$job$);
END $$;
REVOKE ALL ON FUNCTION public.arm_spa_checkout_sweep() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.arm_spa_checkout_sweep() TO service_role;

CREATE OR REPLACE FUNCTION public.spa_checkout_arm_sweep_trg() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status='pending' AND NEW.appointment_id IS NULL AND (NEW.payment_intent_id IS NOT NULL OR NEW.setup_intent_id IS NOT NULL) THEN
    PERFORM public.arm_spa_checkout_sweep();
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.spa_checkout_arm_sweep_trg() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS spa_checkout_arm_sweep ON public.spa_guest_checkouts;
CREATE TRIGGER spa_checkout_arm_sweep AFTER UPDATE OF payment_intent_id, setup_intent_id ON public.spa_guest_checkouts
  FOR EACH ROW EXECUTE FUNCTION public.spa_checkout_arm_sweep_trg();

SELECT public.arm_spa_checkout_sweep();