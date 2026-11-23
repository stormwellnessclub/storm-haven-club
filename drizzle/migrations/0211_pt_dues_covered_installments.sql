CREATE OR REPLACE FUNCTION public.pt_apply_dues_covered_installments()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE r record; v_inv text; v_n int := 0; v_next timestamptz; u timestamp;
BEGIN
  PERFORM pg_advisory_xact_lock(7402917);
  FOR r IN SELECT i.id, i.pass_id, i.due_date, m.stripe_customer_id
    FROM pt_payment_plan_installments i JOIN members m ON m.user_id = i.user_id
    WHERE i.paid_via = 'Covered by membership dues' AND i.status = 'scheduled'
      AND i.due_date <= (now() AT TIME ZONE 'America/Detroit')::date
  LOOP
    SELECT l.stripe_invoice_id INTO v_inv FROM revenue_ledger l
     WHERE l.stripe_customer_id = r.stripe_customer_id AND l.area = 'dues' AND l.kind = 'sale'
       AND l.gross_cents > 0 AND l.stripe_invoice_id IS NOT NULL
       AND date_trunc('month', l.business_date) = date_trunc('month', r.due_date - 9)
       AND NOT EXISTS (SELECT 1 FROM pt_payment_plan_installments x WHERE x.stripe_invoice_id = l.stripe_invoice_id)
     ORDER BY l.business_date LIMIT 1;
    IF v_inv IS NOT NULL THEN
      UPDATE pt_payment_plan_installments SET status='paid', paid_at=now(), stripe_invoice_id=v_inv, updated_at=now() WHERE id=r.id;
      UPDATE pt_passes p SET payment_plan_installments_paid = (SELECT count(*) FROM pt_payment_plan_installments WHERE pass_id=p.id AND status='paid'),
        payment_plan_next_payment_date = (SELECT min(due_date) FROM pt_payment_plan_installments WHERE pass_id=p.id AND status='scheduled'),
        payment_plan_status = CASE WHEN NOT EXISTS (SELECT 1 FROM pt_payment_plan_installments WHERE pass_id=p.id AND status='scheduled') THEN 'completed' ELSE payment_plan_status END,
        updated_at=now() WHERE p.id = r.pass_id;
      v_n := v_n + 1;
    END IF;
  END LOOP;
  -- Re-arm a single one-time check while anything remains.
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='pt-dues-covered-check';
  SELECT min(greatest(((due_date::timestamp + time '18:00') AT TIME ZONE 'America/Detroit'), now() + interval '7 days'))
    INTO v_next FROM pt_payment_plan_installments WHERE paid_via='Covered by membership dues' AND status='scheduled';
  IF v_next IS NOT NULL THEN
    u := v_next AT TIME ZONE 'UTC';
    PERFORM cron.schedule('pt-dues-covered-check', format('%s %s %s %s *', extract(minute from u)::int, extract(hour from u)::int, extract(day from u)::int, extract(month from u)::int),
      $job$select cron.unschedule('pt-dues-covered-check'); select public.pt_apply_dues_covered_installments();$job$);
  END IF;
  RETURN v_n;
END $f$;
REVOKE ALL ON FUNCTION public.pt_apply_dues_covered_installments() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_apply_dues_covered_installments() TO service_role;
DO $$ BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='pt-dues-covered-check';
  -- Dec 10 2026 18:00 Detroit = 23:00 UTC
  PERFORM cron.schedule('pt-dues-covered-check', '0 23 10 12 *',
    $job$select cron.unschedule('pt-dues-covered-check'); select public.pt_apply_dues_covered_installments();$job$);
END $$;