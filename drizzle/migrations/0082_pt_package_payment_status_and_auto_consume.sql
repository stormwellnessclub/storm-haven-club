CREATE OR REPLACE FUNCTION public.pt_sync_pass_payment_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF COALESCE(NEW.package_deducted,false) AND NEW.pass_id IS NOT NULL
     AND NEW.payment_status::text IN ('unpaid','past_due') THEN
    NEW.payment_status := 'pass';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pt_sync_pass_payment_status ON public.pt_appointments;
CREATE TRIGGER pt_sync_pass_payment_status BEFORE INSERT OR UPDATE ON public.pt_appointments
FOR EACH ROW EXECUTE FUNCTION public.pt_sync_pass_payment_status();

UPDATE public.pt_appointments SET updated_at = updated_at
WHERE package_deducted AND pass_id IS NOT NULL AND payment_status::text IN ('unpaid','past_due');

CREATE OR REPLACE FUNCTION public.pt_auto_consume_past_reservations()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT id FROM pt_appointments
    WHERE status = 'scheduled' AND COALESCE(is_waitlist,false) = false
      AND reservation_state = 'reserved' AND pass_id IS NOT NULL
      AND COALESCE(ends_at, starts_at) < now()
  LOOP
    BEGIN
      PERFORM pt_reservation_consume(r.id, 'Session auto-used after scheduled time', 'appt_complete:' || r.id::text, NULL);
      UPDATE pt_appointments SET status = 'completed', completed_at = COALESCE(completed_at, now()), updated_at = now()
       WHERE id = r.id;
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'auto-consume failed for %: %', r.id, SQLERRM;
    END;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.pt_auto_consume_past_reservations() FROM PUBLIC, anon, authenticated;

SELECT public.pt_auto_consume_past_reservations();

DO $$ BEGIN
  PERFORM cron.unschedule('pt-auto-consume-past-reservations');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('pt-auto-consume-past-reservations', '0 * * * *', 'SELECT public.pt_auto_consume_past_reservations();');