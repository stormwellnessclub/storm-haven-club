CREATE TABLE public.spa_therapist_blocks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 therapist_id uuid NOT NULL REFERENCES public.spa_therapists(id),
 block_date date NOT NULL, start_time time NOT NULL, end_time time NOT NULL,
 note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT spa_block_time_order CHECK (end_time > start_time)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spa_therapist_blocks TO authenticated;
GRANT ALL ON public.spa_therapist_blocks TO service_role;
ALTER TABLE public.spa_therapist_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY spa_blocks_staff ON public.spa_therapist_blocks FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk','spa_staff']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk','spa_staff']::public.app_role[]));
CREATE INDEX spa_blocks_date_therapist ON public.spa_therapist_blocks(block_date,therapist_id);
CREATE FUNCTION public.enforce_spa_therapist_block() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
BEGIN
 IF NEW.staff_id IS NULL OR NEW.status IN ('cancelled','no_show') THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('spa:' || NEW.appointment_date::text,0));
 IF EXISTS (SELECT 1 FROM public.spa_therapist_blocks b WHERE b.therapist_id=NEW.staff_id AND b.block_date=NEW.appointment_date
  AND tsrange(b.block_date+b.start_time,b.block_date+b.end_time,'[)') && tsrange(NEW.appointment_date+NEW.appointment_time, NEW.appointment_date+NEW.appointment_time+make_interval(mins=>NEW.duration_minutes+COALESCE(NEW.cleanup_minutes,15)),'[)'))
 THEN RAISE EXCEPTION 'This therapist is unavailable during the selected time.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER spa_therapist_block_guard BEFORE INSERT OR UPDATE OF staff_id, appointment_date, appointment_time, duration_minutes, cleanup_minutes, status ON public.spa_appointments FOR EACH ROW EXECUTE FUNCTION public.enforce_spa_therapist_block();
CREATE FUNCTION public.enforce_spa_block_against_bookings() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
BEGIN
 IF TG_OP='UPDATE' THEN PERFORM pg_advisory_xact_lock(hashtextextended('spa:' || LEAST(OLD.block_date,NEW.block_date)::text,0)); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('spa:' || NEW.block_date::text,0));
 IF EXISTS (SELECT 1 FROM public.spa_appointments a WHERE a.staff_id=NEW.therapist_id AND a.appointment_date=NEW.block_date AND a.status NOT IN ('cancelled','no_show')
 AND tsrange(NEW.block_date+NEW.start_time,NEW.block_date+NEW.end_time,'[)') && tsrange(a.appointment_date+a.appointment_time,a.appointment_date+a.appointment_time+make_interval(mins=>a.duration_minutes+COALESCE(a.cleanup_minutes,15)),'[)'))
 THEN RAISE EXCEPTION 'An existing appointment overlaps this block. Reschedule it before blocking this time.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER spa_block_booking_guard BEFORE INSERT OR UPDATE ON public.spa_therapist_blocks FOR EACH ROW EXECUTE FUNCTION public.enforce_spa_block_against_bookings();
REVOKE ALL ON FUNCTION public.enforce_spa_therapist_block(),public.enforce_spa_block_against_bookings() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_spa_busy_slots(p_date date)
RETURNS TABLE(appointment_time time,duration_minutes integer,cleanup_minutes integer,staff_id uuid,room_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
 SELECT a.appointment_time,COALESCE(a.duration_minutes,0),COALESCE(a.cleanup_minutes,0),a.staff_id,a.room_id FROM public.spa_appointments a WHERE a.appointment_date=p_date AND a.status IN ('confirmed','pending','checked_in','in_progress')
 UNION ALL SELECT b.start_time,GREATEST(0,(EXTRACT(EPOCH FROM (b.end_time-b.start_time))/60)::integer),0,NULL::uuid,b.spa_room_id FROM public.private_event_blocks b WHERE b.block_date=p_date AND b.spa_room_id IS NOT NULL
 UNION ALL SELECT b.start_time,(EXTRACT(EPOCH FROM (b.end_time-b.start_time))/60)::integer,0,b.therapist_id,NULL::uuid FROM public.spa_therapist_blocks b WHERE b.block_date=p_date;
$f$;
GRANT EXECUTE ON FUNCTION public.get_spa_busy_slots(date) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.check_spa_appointment_conflict(p_appointment_date date,p_appointment_time time,p_duration_minutes integer,p_cleanup_minutes integer DEFAULT 15,p_staff_id uuid DEFAULT NULL,p_room_id uuid DEFAULT NULL,p_exclude_appointment_id uuid DEFAULT NULL)
RETURNS TABLE(has_conflict boolean,conflict_type text,conflicting_appointment_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE v_start timestamp := p_appointment_date+p_appointment_time; v_end timestamp; v_id uuid;
BEGIN
 v_end := v_start+make_interval(mins=>p_duration_minutes+COALESCE(p_cleanup_minutes,15));
 IF p_staff_id IS NOT NULL THEN
  SELECT b.id INTO v_id FROM public.spa_therapist_blocks b WHERE b.therapist_id=p_staff_id AND b.block_date=p_appointment_date AND tsrange(b.block_date+b.start_time,b.block_date+b.end_time,'[)') && tsrange(v_start,v_end,'[)') LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN QUERY SELECT true,'staff_block'::text,v_id; RETURN; END IF;
 END IF;
 SELECT a.id INTO v_id FROM public.spa_appointments a WHERE a.appointment_date=p_appointment_date AND a.staff_id=p_staff_id AND a.status IN ('confirmed','pending','checked_in','in_progress') AND (p_exclude_appointment_id IS NULL OR a.id<>p_exclude_appointment_id)
 AND tsrange(a.appointment_date+a.appointment_time,a.appointment_date+a.appointment_time+make_interval(mins=>COALESCE(a.duration_minutes,60)+COALESCE(a.cleanup_minutes,15)),'[)') && tsrange(v_start,v_end,'[)') LIMIT 1;
 IF v_id IS NOT NULL THEN RETURN QUERY SELECT true,'staff'::text,v_id; RETURN; END IF;
 SELECT a.id INTO v_id FROM public.spa_appointments a WHERE a.appointment_date=p_appointment_date AND a.room_id=p_room_id AND a.status IN ('confirmed','pending','checked_in','in_progress') AND (p_exclude_appointment_id IS NULL OR a.id<>p_exclude_appointment_id)
 AND tsrange(a.appointment_date+a.appointment_time,a.appointment_date+a.appointment_time+make_interval(mins=>COALESCE(a.duration_minutes,60)+COALESCE(a.cleanup_minutes,15)),'[)') && tsrange(v_start,v_end,'[)') LIMIT 1;
 IF v_id IS NOT NULL THEN RETURN QUERY SELECT true,'room'::text,v_id; RETURN; END IF;
 RETURN QUERY SELECT false,NULL::text,NULL::uuid;
END $f$;
GRANT EXECUTE ON FUNCTION public.check_spa_appointment_conflict(date,time,integer,integer,uuid,uuid,uuid) TO anon,authenticated,service_role;