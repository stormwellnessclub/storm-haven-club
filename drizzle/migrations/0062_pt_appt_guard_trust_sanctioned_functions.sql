CREATE OR REPLACE FUNCTION public.guard_pt_appointments_member_update()
 RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $function$
DECLARE
  changed text[];
  allowed text[] := ARRAY['status','cancel_reason','cancelled_at','cancelled_by','updated_at'];
  bad text;
BEGIN
  -- Writes made inside sanctioned SECURITY DEFINER PT functions (cancellation, reservation ledger)
  -- run as the function owner, not as the API role; only direct API writes are restricted.
  IF current_user NOT IN ('authenticated','anon') THEN RETURN NEW; END IF;
  IF public.is_privileged_row_writer() THEN RETURN NEW; END IF;
  IF NEW.instructor_id IS NOT NULL AND NEW.instructor_id = public.pt_my_instructor_id(auth.uid()) THEN RETURN NEW; END IF;
  changed := public.changed_columns(to_jsonb(OLD), to_jsonb(NEW));
  FOREACH bad IN ARRAY changed LOOP
    IF NOT (bad = ANY(allowed)) THEN
      RAISE EXCEPTION 'Not allowed to change % on your appointment', bad USING ERRCODE = '42501';
    END IF;
  END LOOP;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status::text NOT IN ('cancelled','late_cancel') THEN
    RAISE EXCEPTION 'You may only cancel your appointment' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;