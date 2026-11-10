-- Phase 2D.3: one authoritative PT availability engine (additive; client booking stays OFF)

-- 1. Date-specific "replace" exceptions alongside existing block/extra
ALTER TABLE public.pt_trainer_overrides DROP CONSTRAINT IF EXISTS pt_trainer_overrides_kind_check;
ALTER TABLE public.pt_trainer_overrides ADD CONSTRAINT pt_trainer_overrides_kind_check
  CHECK (kind = ANY (ARRAY['block'::text, 'extra'::text, 'replace'::text]));
COMMENT ON COLUMN public.pt_trainer_overrides.kind IS
  'block = time off (all day when no times, multi-day via end_date); extra = added hours; replace = hours for that date replace the normal week (no times = unavailable that day)';
ALTER TABLE public.pt_trainer_overrides DROP CONSTRAINT IF EXISTS pt_trainer_overrides_check;
ALTER TABLE public.pt_trainer_overrides ADD CONSTRAINT pt_trainer_overrides_check
  CHECK (kind IN ('block','replace') OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time));

-- 2. Structured request window + requested vs confirmed time
ALTER TABLE public.training_requests
  ADD COLUMN IF NOT EXISTS earliest_time time,
  ADD COLUMN IF NOT EXISTS latest_time time,
  ADD COLUMN IF NOT EXISTS flexibility text NOT NULL DEFAULT 'exact',
  ADD COLUMN IF NOT EXISTS confirmed_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_trainer_id uuid,
  ADD COLUMN IF NOT EXISTS confirmation_outcome text;
ALTER TABLE public.training_requests DROP CONSTRAINT IF EXISTS training_requests_flexibility_chk;
ALTER TABLE public.training_requests ADD CONSTRAINT training_requests_flexibility_chk
  CHECK (flexibility IN ('exact','window','any_time_that_day','any_day'));
ALTER TABLE public.training_requests DROP CONSTRAINT IF EXISTS training_requests_outcome_chk;
ALTER TABLE public.training_requests ADD CONSTRAINT training_requests_outcome_chk
  CHECK (confirmation_outcome IS NULL OR confirmation_outcome IN ('requested_time','within_window','alternate_accepted'));

-- 3. Override audit on appointments
ALTER TABLE public.pt_appointments
  ADD COLUMN IF NOT EXISTS availability_override_reason text,
  ADD COLUMN IF NOT EXISTS availability_override_by uuid,
  ADD COLUMN IF NOT EXISTS availability_override_at timestamptz,
  ADD COLUMN IF NOT EXISTS availability_override_detail jsonb;

-- 4. Request lifecycle events (data for future messages; nothing is sent)
CREATE TABLE IF NOT EXISTS public.pt_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.training_requests(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('request_received','confirmed_requested_time','confirmed_within_window','alternate_offered','alternate_accepted','request_declined','request_cancelled')),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pt_request_events TO authenticated;
GRANT ALL ON public.pt_request_events TO service_role;
ALTER TABLE public.pt_request_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PT staff read request events" ON public.pt_request_events FOR SELECT TO authenticated
  USING (public.pt_is_staff_or_desk(auth.uid()));

CREATE OR REPLACE FUNCTION public.pt_log_request_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_type text;
BEGIN
  IF NEW.request_kind <> 'appointment_request' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' OR (OLD.request_kind IS DISTINCT FROM NEW.request_kind) THEN
    IF NEW.request_status = 'requested' THEN v_type := 'request_received'; END IF;
  ELSIF NEW.request_status IS DISTINCT FROM OLD.request_status THEN
    v_type := CASE NEW.request_status
      WHEN 'alternate_offered' THEN 'alternate_offered'
      WHEN 'declined' THEN 'request_declined'
      WHEN 'cancelled' THEN 'request_cancelled'
      WHEN 'confirmed' THEN CASE NEW.confirmation_outcome
          WHEN 'within_window' THEN 'confirmed_within_window'
          WHEN 'alternate_accepted' THEN 'alternate_accepted'
          ELSE 'confirmed_requested_time' END
      ELSE NULL END;
  END IF;
  IF v_type IS NOT NULL THEN
    INSERT INTO pt_request_events(request_id, event_type, actor, detail)
    VALUES (NEW.id, v_type, auth.uid(), jsonb_build_object(
      'preferred_date', NEW.preferred_date, 'preferred_time', NEW.preferred_time,
      'confirmed_starts_at', NEW.confirmed_starts_at, 'alt_date', NEW.alt_date, 'alt_time', NEW.alt_time));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_pt_log_request_event ON public.training_requests;
CREATE TRIGGER trg_pt_log_request_event AFTER INSERT OR UPDATE ON public.training_requests
  FOR EACH ROW EXECUTE FUNCTION public.pt_log_request_event();

-- 5. Waitlist / openings (never creates an appointment)
CREATE TABLE IF NOT EXISTS public.pt_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL,
  preferred_trainer_id uuid REFERENCES public.instructors(id) ON DELETE SET NULL,
  session_type_id uuid REFERENCES public.pt_session_types(id),
  preferred_date date,
  preferred_time time,
  earliest_time time,
  latest_time time,
  flexibility text NOT NULL DEFAULT 'window' CHECK (flexibility IN ('exact','window','any_time_that_day','any_day')),
  notes text,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','contacted','booked','closed')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_waitlist TO authenticated;
GRANT ALL ON public.pt_waitlist TO service_role;
ALTER TABLE public.pt_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PT staff manage waitlist" ON public.pt_waitlist FOR ALL TO authenticated
  USING (public.pt_is_staff_or_desk(auth.uid())) WITH CHECK (public.pt_is_staff_or_desk(auth.uid()));
CREATE INDEX IF NOT EXISTS pt_waitlist_status_created_idx ON public.pt_waitlist(status, created_at);

-- 6. Trainer working windows for one Detroit date
CREATE OR REPLACE FUNCTION public.pt_trainer_day_windows(p_instructor_id uuid, p_date date)
RETURNS TABLE(win_start timestamptz, win_end timestamptz, source text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH rep AS (
    SELECT o.start_time, o.end_time FROM pt_trainer_overrides o
     WHERE o.instructor_id = p_instructor_id AND o.kind = 'replace'
       AND p_date BETWEEN o.date AND coalesce(o.end_date, o.date)
  ), base AS (
    SELECT start_time, end_time, 'exception'::text src FROM rep WHERE start_time IS NOT NULL
    UNION ALL
    SELECT v.start_time, v.end_time, 'recurring' FROM pt_trainer_availability v
     WHERE NOT EXISTS (SELECT 1 FROM rep)
       AND v.instructor_id = p_instructor_id AND v.weekday = extract(dow FROM p_date)
       AND (v.effective_start IS NULL OR v.effective_start <= p_date)
       AND (v.effective_end IS NULL OR v.effective_end >= p_date)
    UNION ALL
    SELECT o.start_time, o.end_time, 'extra' FROM pt_trainer_overrides o
     WHERE o.instructor_id = p_instructor_id AND o.kind = 'extra'
       AND p_date BETWEEN o.date AND coalesce(o.end_date, o.date)
  )
  SELECT ((p_date + start_time) AT TIME ZONE 'America/Detroit'),
         ((p_date + end_time) AT TIME ZONE 'America/Detroit'), src
    FROM base WHERE end_time > start_time
$$;

CREATE OR REPLACE FUNCTION public.pt_trainer_has_schedule(p_instructor_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM pt_trainer_availability WHERE instructor_id = p_instructor_id)
      OR EXISTS (SELECT 1 FROM pt_trainer_overrides WHERE instructor_id = p_instructor_id AND kind IN ('extra','replace'))
$$;

-- 7. THE engine: evaluate one slot
CREATE OR REPLACE FUNCTION public.pt_check_slot(
  p_starts_at timestamptz, p_ends_at timestamptz,
  p_instructor_id uuid DEFAULT NULL, p_location_id uuid DEFAULT NULL,
  p_exclude_id uuid DEFAULT NULL, p_format pt_format DEFAULT NULL,
  p_user_id uuid DEFAULT NULL, p_session_type_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_conf jsonb; v_client jsonb := '[]'::jsonb; v_avail text := 'available';
  v_date date := (p_starts_at AT TIME ZONE 'America/Detroit')::date;
  v_end_date date := ((p_ends_at - interval '1 second') AT TIME ZONE 'America/Detroit')::date;
  v_block jsonb; v_cap int; v_confirmed int := 0; v_pending int := 0; v_fmt pt_format := p_format;
  v_blocking boolean;
BEGIN
  IF NOT public.pt_is_staff_or_desk(auth.uid()) AND NOT (p_user_id IS NOT NULL AND p_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_ends_at <= p_starts_at THEN RAISE EXCEPTION 'End must be after start'; END IF;
  IF p_session_type_id IS NOT NULL THEN
    SELECT coalesce(v_fmt, format), greatest(capacity,1) INTO v_fmt, v_cap FROM pt_session_types WHERE id = p_session_type_id;
  END IF;

  -- existing trainer/room/group rules (2D conflict logic, reused)
  v_conf := public.pt_check_appointment_conflict(p_starts_at, p_ends_at, p_instructor_id, p_location_id, p_exclude_id, v_fmt);
  v_cap := coalesce(v_cap, (v_conf->>'group_capacity')::int, 1);

  -- capacity counts: confirmed only; pending requests reported separately
  SELECT count(*) INTO v_confirmed FROM pt_appointments a
   WHERE a.starts_at = p_starts_at AND a.ends_at = p_ends_at
     AND a.instructor_id IS NOT DISTINCT FROM p_instructor_id
     AND a.status NOT IN ('cancelled','late_cancel','no_show') AND coalesce(a.is_waitlist,false) = false
     AND (p_exclude_id IS NULL OR a.id <> p_exclude_id);
  IF p_instructor_id IS NOT NULL THEN
    SELECT count(*) INTO v_pending FROM training_requests r
     WHERE r.request_kind = 'appointment_request' AND r.request_status IN ('requested','under_review','alternate_offered')
       AND r.requested_trainer_id = p_instructor_id AND r.preferred_date = v_date
       AND ((r.preferred_date + r.preferred_time) AT TIME ZONE 'America/Detroit') = p_starts_at;
  END IF;

  -- client overlap
  IF p_user_id IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'starts_at', o.starts_at, 'ends_at', o.ends_at, 'instructor_id', o.instructor_id)), '[]'::jsonb)
      INTO v_client FROM pt_appointments o
     WHERE o.user_id = p_user_id AND (p_exclude_id IS NULL OR o.id <> p_exclude_id)
       AND o.status NOT IN ('cancelled','late_cancel','no_show') AND coalesce(o.is_waitlist,false) = false
       AND o.starts_at < p_ends_at AND o.ends_at > p_starts_at;
  END IF;

  -- trainer hours + time off
  IF p_instructor_id IS NOT NULL THEN
    SELECT jsonb_build_object('id', o.id, 'date', o.date, 'end_date', o.end_date, 'start_time', o.start_time, 'end_time', o.end_time, 'note', o.note)
      INTO v_block FROM pt_trainer_overrides o
     WHERE o.instructor_id = p_instructor_id AND o.kind = 'block'
       AND o.date <= v_end_date AND coalesce(o.end_date, o.date) >= v_date
       AND (o.start_time IS NULL OR o.end_time IS NULL OR EXISTS (
             SELECT 1 FROM generate_series(greatest(o.date, v_date), least(coalesce(o.end_date,o.date), v_end_date), interval '1 day') d
              WHERE ((d::date + o.start_time) AT TIME ZONE 'America/Detroit') < p_ends_at
                AND ((d::date + o.end_time) AT TIME ZONE 'America/Detroit') > p_starts_at))
     LIMIT 1;
    IF v_block IS NOT NULL THEN
      v_avail := 'time_off';
    ELSIF NOT public.pt_trainer_has_schedule(p_instructor_id) THEN
      v_avail := 'not_configured';
    ELSIF NOT EXISTS (SELECT 1 FROM public.pt_trainer_day_windows(p_instructor_id, v_date) w
                       WHERE w.win_start <= p_starts_at AND w.win_end >= p_ends_at) THEN
      v_avail := 'outside_hours';
    END IF;
  END IF;

  v_blocking := coalesce((v_conf->>'has_conflict')::boolean, false)
             OR jsonb_array_length(v_client) > 0
             OR v_avail IN ('time_off','outside_hours');

  RETURN v_conf || jsonb_build_object(
    'has_conflict', v_blocking,
    'availability', v_avail,
    'time_off', v_block,
    'client_conflicts', v_client,
    'room_unavailable', jsonb_array_length(coalesce(v_conf->'room_conflicts','[]'::jsonb)) > 0,
    'capacity', v_cap,
    'confirmed', v_confirmed,
    'pending_requests', v_pending,
    'open_spots', greatest(v_cap - v_confirmed, 0));
END $$;

-- 8. Bookable start times (whole session must fit; 15-minute steps)
CREATE OR REPLACE FUNCTION public.pt_available_slots(
  p_instructor_id uuid, p_from date, p_to date, p_session_type_id uuid,
  p_user_id uuid DEFAULT NULL, p_location_id uuid DEFAULT NULL, p_step_minutes int DEFAULT 15)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE st pt_session_types; d date; w record; t timestamptz; v_end timestamptz; r jsonb; v_out jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.pt_is_staff_or_desk(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_to < p_from OR p_to - p_from > 62 THEN RAISE EXCEPTION 'Choose a range of up to 62 days'; END IF;
  SELECT * INTO st FROM pt_session_types WHERE id = p_session_type_id;
  IF st.id IS NULL THEN RAISE EXCEPTION 'Session type not found'; END IF;
  FOR d IN SELECT generate_series(p_from, p_to, interval '1 day')::date LOOP
    FOR w IN SELECT * FROM public.pt_trainer_day_windows(p_instructor_id, d) ORDER BY 1 LOOP
      t := w.win_start;
      WHILE t + make_interval(mins => st.duration_minutes) <= w.win_end LOOP
        v_end := t + make_interval(mins => st.duration_minutes);
        IF t > now() THEN
          r := public.pt_check_slot(t, v_end, p_instructor_id, coalesce(p_location_id, st.default_location_id), NULL, st.format, p_user_id, st.id);
          IF NOT (r->>'has_conflict')::boolean AND (r->>'open_spots')::int > 0 THEN
            v_out := v_out || jsonb_build_array(jsonb_build_object('starts_at', t, 'ends_at', v_end,
              'capacity', r->'capacity', 'confirmed', r->'confirmed', 'pending_requests', r->'pending_requests', 'open_spots', r->'open_spots'));
          END IF;
        END IF;
        t := t + make_interval(mins => greatest(p_step_minutes, 5));
      END LOOP;
    END LOOP;
  END LOOP;
  RETURN v_out;
END $$;

-- 9. Trainer readiness (informational; never enables booking)
CREATE OR REPLACE FUNCTION public.pt_trainer_readiness()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.pt_is_staff_or_desk(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'name'), '[]'::jsonb) INTO v FROM (
    SELECT jsonb_build_object(
      'instructor_id', i.id,
      'name', trim(concat(i.first_name,' ',i.last_name)),
      'recurring_configured', EXISTS (SELECT 1 FROM pt_trainer_availability a WHERE a.instructor_id = i.id
          AND (a.effective_end IS NULL OR a.effective_end >= (now() AT TIME ZONE 'America/Detroit')::date)),
      'upcoming_availability', EXISTS (SELECT 1 FROM generate_series((now() AT TIME ZONE 'America/Detroit')::date,
          (now() AT TIME ZONE 'America/Detroit')::date + 13, interval '1 day') g,
          LATERAL public.pt_trainer_day_windows(i.id, g::date) w),
      'time_off_conflicts', (SELECT count(*) FROM pt_appointments a JOIN pt_trainer_overrides o
          ON o.instructor_id = a.instructor_id AND o.kind = 'block'
         AND (a.starts_at AT TIME ZONE 'America/Detroit')::date BETWEEN o.date AND coalesce(o.end_date, o.date)
         AND (o.start_time IS NULL OR o.end_time IS NULL OR
              ((a.starts_at AT TIME ZONE 'America/Detroit')::time < o.end_time AND (a.ends_at AT TIME ZONE 'America/Detroit')::time > o.start_time))
        WHERE a.instructor_id = i.id AND a.status = 'scheduled' AND a.starts_at > now()),
      'client_booking_mode', public.pt_effective_client_booking_mode(i.id)
    ) x
    FROM instructors i
    WHERE EXISTS (SELECT 1 FROM pt_trainer_availability a WHERE a.instructor_id = i.id)
       OR EXISTS (SELECT 1 FROM pt_appointments a WHERE a.instructor_id = i.id AND a.starts_at > now() - interval '60 days')
       OR EXISTS (SELECT 1 FROM pt_trainer_client_booking b WHERE b.instructor_id = i.id)
  ) s;
  RETURN (SELECT coalesce(jsonb_agg(e || jsonb_build_object('ready',
      (e->>'recurring_configured')::boolean AND (e->>'upcoming_availability')::boolean AND (e->>'time_off_conflicts')::int = 0)), '[]'::jsonb)
    FROM jsonb_array_elements(v) e);
END $$;

-- 10. Waitlist matches for an opening
CREATE OR REPLACE FUNCTION public.pt_waitlist_matches(p_starts_at timestamptz, p_ends_at timestamptz, p_instructor_id uuid, p_session_type_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_d date := (p_starts_at AT TIME ZONE 'America/Detroit')::date;
  v_s time := (p_starts_at AT TIME ZONE 'America/Detroit')::time; v_e time := (p_ends_at AT TIME ZONE 'America/Detroit')::time; v jsonb;
BEGIN
  IF NOT public.pt_is_staff_or_desk(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(w) ORDER BY w.created_at), '[]'::jsonb) INTO v FROM pt_waitlist w
   WHERE w.status = 'waiting'
     AND (w.preferred_trainer_id IS NULL OR w.preferred_trainer_id = p_instructor_id)
     AND (p_session_type_id IS NULL OR w.session_type_id IS NULL OR w.session_type_id = p_session_type_id)
     AND (w.flexibility = 'any_day' OR w.preferred_date IS NULL OR w.preferred_date = v_d)
     AND (w.flexibility IN ('any_time_that_day','any_day')
          OR (w.flexibility = 'exact' AND w.preferred_time = v_s)
          OR (w.flexibility = 'window' AND coalesce(w.earliest_time, w.preferred_time, '00:00') <= v_s
                                       AND coalesce(w.latest_time, '23:59') >= v_e));
  RETURN v;
END $$;

REVOKE EXECUTE ON FUNCTION public.pt_trainer_day_windows(uuid,date), public.pt_trainer_has_schedule(uuid),
  public.pt_check_slot(timestamptz,timestamptz,uuid,uuid,uuid,pt_format,uuid,uuid),
  public.pt_available_slots(uuid,date,date,uuid,uuid,uuid,int), public.pt_trainer_readiness(),
  public.pt_waitlist_matches(timestamptz,timestamptz,uuid,uuid), public.pt_log_request_event() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_check_slot(timestamptz,timestamptz,uuid,uuid,uuid,pt_format,uuid,uuid),
  public.pt_available_slots(uuid,date,date,uuid,uuid,uuid,int), public.pt_trainer_readiness(),
  public.pt_waitlist_matches(timestamptz,timestamptz,uuid,uuid) TO authenticated, service_role;

-- 11. Staff booking uses the engine; override = admin/manager + reason, audited
DROP FUNCTION IF EXISTS public.book_pt_appointment(uuid, pt_format, timestamptz, integer, uuid, text, uuid, boolean, integer, uuid, boolean);
CREATE FUNCTION public.book_pt_appointment(p_user_id uuid, p_format pt_format, p_starts_at timestamp with time zone, p_duration_minutes integer DEFAULT 60, p_instructor_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text, p_pass_id uuid DEFAULT NULL::uuid, p_unpaid boolean DEFAULT false, p_rate_cents integer DEFAULT 0, p_location_id uuid DEFAULT NULL::uuid, p_force boolean DEFAULT false, p_override_reason text DEFAULT NULL::text)
 RETURNS pt_appointments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pass public.pt_passes;
  v_appt public.pt_appointments;
  v_admin uuid := auth.uid();
  v_is_staff boolean := has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role,'front_desk'::app_role]);
  v_ends_at timestamptz := p_starts_at + (p_duration_minutes || ' minutes')::interval;
  v_conflict jsonb;
  v_override boolean := false;
BEGIN
  IF NOT v_is_staff AND auth.uid() <> p_user_id THEN RAISE EXCEPTION 'Not authorized to book for this user'; END IF;
  IF NOT v_is_staff THEN
    IF COALESCE(p_force, false) THEN RAISE EXCEPTION 'Only staff can override scheduling conflicts'; END IF;
    IF NOT public.pt_is_client(auth.uid()) OR public.pt_effective_client_booking_mode(p_instructor_id) <> 'instant' THEN
      RAISE EXCEPTION 'BOOKING_CLOSED: Online PT booking is not available. Please contact the club.';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.pt_appointments a WHERE a.user_id = p_user_id AND a.starts_at = p_starts_at
      AND a.ends_at = v_ends_at AND a.status NOT IN ('cancelled','late_cancel','no_show')) THEN
    RAISE EXCEPTION 'ALREADY_BOOKED: This client is already booked for that time.';
  END IF;

  v_conflict := public.pt_check_slot(p_starts_at, v_ends_at, p_instructor_id, p_location_id, NULL, p_format, p_user_id, NULL);
  IF (v_conflict->>'has_conflict')::boolean THEN
    IF COALESCE(p_force, false) THEN
      IF NOT has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role]) THEN
        RAISE EXCEPTION 'OVERRIDE_NOT_ALLOWED: Only an admin or manager can book outside availability.';
      END IF;
      IF NULLIF(btrim(coalesce(p_override_reason,'')), '') IS NULL THEN
        RAISE EXCEPTION 'OVERRIDE_REASON_REQUIRED: Add a reason to book outside availability.';
      END IF;
      v_override := true;
    ELSE
      IF COALESCE((v_conflict->>'group_full')::boolean, false) THEN
        RAISE EXCEPTION 'GROUP_FULL: Semi-private session is full (% of %).', v_conflict->>'group_count', v_conflict->>'group_capacity';
      END IF;
      RAISE EXCEPTION 'CONFLICT: %', v_conflict::text;
    END IF;
  END IF;

  IF p_unpaid THEN
    IF NOT v_is_staff THEN RAISE EXCEPTION 'Only staff can book an unpaid session'; END IF;
    INSERT INTO public.pt_appointments (user_id, pass_id, usage_id, instructor_id, location_id, format,
      starts_at, ends_at, duration_minutes, notes, booked_by_admin_id, payment_status, amount_due_cents)
    VALUES (p_user_id, NULL, NULL, p_instructor_id, p_location_id, p_format, p_starts_at, v_ends_at,
      p_duration_minutes, p_notes, v_admin, 'unpaid', GREATEST(COALESCE(p_rate_cents, 0), 0))
    RETURNING * INTO v_appt;
  ELSE
    IF p_pass_id IS NOT NULL THEN
      SELECT * INTO v_pass FROM public.pt_passes WHERE id = p_pass_id AND user_id = p_user_id AND status = 'active'
         AND expires_at >= (now() AT TIME ZONE 'America/Detroit')::date FOR UPDATE;
    ELSE
      SELECT * INTO v_pass FROM public.pt_passes WHERE user_id = p_user_id AND format = p_format AND status = 'active'
         AND expires_at >= (now() AT TIME ZONE 'America/Detroit')::date
         AND sessions_remaining - public.pt_pass_reserved_count(id) > 0
       ORDER BY expires_at ASC, created_at ASC LIMIT 1 FOR UPDATE;
    END IF;

    IF v_pass.id IS NULL OR v_pass.sessions_remaining - public.pt_pass_reserved_count(v_pass.id) <= 0 THEN
      RAISE EXCEPTION 'NO_SESSIONS: This customer has no % sessions available to book. Sell a pack first.', p_format;
    END IF;

    INSERT INTO public.pt_appointments (user_id, pass_id, usage_id, instructor_id, location_id, format,
      starts_at, ends_at, duration_minutes, notes, booked_by_admin_id, payment_status,
      package_deducted, reservation_state, reserved_at)
    VALUES (p_user_id, v_pass.id, NULL, p_instructor_id, p_location_id, p_format, p_starts_at, v_ends_at,
      p_duration_minutes, p_notes, CASE WHEN v_is_staff THEN v_admin END, 'pass', false, 'reserved', now())
    RETURNING * INTO v_appt;

    PERFORM public.pt_apply_session_delta(v_pass.id, 0, 'session_reserved', 'Session reserved for booked appointment',
      v_appt.id, 'appt_reserve:' || v_appt.id::text, NULL, CASE WHEN v_is_staff THEN v_admin END, p_starts_at);
  END IF;

  IF v_override THEN
    UPDATE public.pt_appointments SET availability_override_reason = btrim(p_override_reason),
      availability_override_by = v_admin, availability_override_at = now(), availability_override_detail = v_conflict
     WHERE id = v_appt.id RETURNING * INTO v_appt;
  END IF;
  RETURN v_appt;
END $function$;
REVOKE EXECUTE ON FUNCTION public.book_pt_appointment(uuid, pt_format, timestamptz, integer, uuid, text, uuid, boolean, integer, uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_pt_appointment(uuid, pt_format, timestamptz, integer, uuid, text, uuid, boolean, integer, uuid, boolean, text) TO authenticated, service_role;

-- 12. Reschedule / trainer change use the engine
DROP FUNCTION IF EXISTS public.pt_reschedule_appointment(uuid, timestamptz, integer, uuid, uuid, boolean, text, boolean);
CREATE FUNCTION public.pt_reschedule_appointment(p_appointment_id uuid, p_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_duration_minutes integer DEFAULT NULL::integer, p_instructor_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid, p_force boolean DEFAULT false, p_reason text DEFAULT NULL::text, p_clear_instructor boolean DEFAULT false, p_override_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_appt pt_appointments%ROWTYPE; v_start timestamptz; v_dur integer; v_end timestamptz;
  v_instructor uuid; v_location uuid; v_conflict jsonb; v_has boolean; v_ovr text;
BEGIN
  SELECT * INTO v_appt FROM pt_appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  IF NOT public.pt_can_manage_appointment(auth.uid(), v_appt.instructor_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_appt.status <> 'scheduled' THEN RAISE EXCEPTION 'Only upcoming appointments can be moved (this one is %)', v_appt.status; END IF;

  v_start := coalesce(p_starts_at, v_appt.starts_at);
  v_dur := coalesce(p_duration_minutes, v_appt.duration_minutes);
  v_end := v_start + make_interval(mins => v_dur);
  v_instructor := CASE WHEN p_clear_instructor THEN NULL ELSE coalesce(p_instructor_id, v_appt.instructor_id) END;
  v_location := coalesce(p_location_id, v_appt.location_id);

  IF v_instructor IS DISTINCT FROM v_appt.instructor_id
     AND NOT public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[]) THEN
    RAISE EXCEPTION 'Only staff can reassign the trainer';
  END IF;

  v_conflict := public.pt_check_slot(v_start, v_end, v_instructor, v_location, p_appointment_id, v_appt.format, v_appt.user_id, v_appt.session_type_id);
  v_has := COALESCE((v_conflict->>'has_conflict')::boolean, false);

  IF v_has AND NOT p_force THEN RETURN jsonb_build_object('success', false, 'conflict', v_conflict); END IF;
  IF v_has THEN
    IF NOT public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager']::app_role[]) THEN
      RAISE EXCEPTION 'OVERRIDE_NOT_ALLOWED: Only an admin or manager can move a session outside availability.';
    END IF;
    v_ovr := NULLIF(btrim(coalesce(p_override_reason, p_reason, '')), '');
    IF v_ovr IS NULL THEN RAISE EXCEPTION 'OVERRIDE_REASON_REQUIRED: Add a reason to move outside availability.'; END IF;
  END IF;

  UPDATE pt_appointments SET starts_at = v_start, ends_at = v_end, duration_minutes = v_dur,
    instructor_id = v_instructor, location_id = v_location,
    reschedule_note = NULLIF(btrim(COALESCE(p_reason,'')), ''), updated_at = now(),
    availability_override_reason = CASE WHEN v_has THEN v_ovr ELSE availability_override_reason END,
    availability_override_by = CASE WHEN v_has THEN auth.uid() ELSE availability_override_by END,
    availability_override_at = CASE WHEN v_has THEN now() ELSE availability_override_at END,
    availability_override_detail = CASE WHEN v_has THEN v_conflict ELSE availability_override_detail END
  WHERE id = p_appointment_id;
  RETURN jsonb_build_object('success', true, 'conflict', v_conflict);
END $function$;
REVOKE EXECUTE ON FUNCTION public.pt_reschedule_appointment(uuid, timestamptz, integer, uuid, uuid, boolean, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_reschedule_appointment(uuid, timestamptz, integer, uuid, uuid, boolean, text, boolean, text) TO authenticated, service_role;

-- 13. Request confirm uses the engine; staff may pick a time inside the client's window
DROP FUNCTION IF EXISTS public.pt_request_confirm(uuid, boolean);
CREATE FUNCTION public.pt_request_confirm(p_request_id uuid, p_use_alternate boolean DEFAULT false, p_confirm_time time DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r training_requests; st pt_session_types; v_date date; v_time time; v_trainer uuid; v_start timestamptz; v_end timestamptz;
  v_appt pt_appointments; v_has_pass boolean; v_chk jsonb; v_outcome text;
BEGIN
  SELECT * INTO r FROM training_requests WHERE id = p_request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT pt_request_can_act(r) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF r.request_status = 'confirmed' OR r.appointment_id IS NOT NULL THEN
    RETURN jsonb_build_object('appointment_id', r.appointment_id, 'already_confirmed', true);
  END IF;
  IF r.request_kind <> 'appointment_request' THEN
    RAISE EXCEPTION 'This is a website inquiry. Convert it to an appointment request before confirming';
  END IF;
  IF r.request_status IN ('declined','cancelled') THEN RAISE EXCEPTION 'This request is already %', r.request_status; END IF;
  IF r.client_user_id IS NULL THEN RAISE EXCEPTION 'Link this request to a client account before confirming'; END IF;
  SELECT * INTO st FROM pt_session_types WHERE id = r.pt_session_type_id;
  IF st.id IS NULL THEN RAISE EXCEPTION 'Choose a session type before confirming'; END IF;
  IF p_use_alternate THEN
    IF r.request_status <> 'alternate_offered' THEN RAISE EXCEPTION 'No alternate has been offered'; END IF;
    v_date := r.alt_date; v_time := r.alt_time; v_trainer := coalesce(r.alt_trainer_id, r.requested_trainer_id);
    v_outcome := 'alternate_accepted';
  ELSE
    v_date := r.preferred_date; v_trainer := r.requested_trainer_id;
    IF p_confirm_time IS NOT NULL AND p_confirm_time IS DISTINCT FROM r.preferred_time THEN
      IF r.flexibility = 'exact' OR (r.flexibility = 'window' AND (r.earliest_time IS NULL OR r.latest_time IS NULL)) THEN
        RAISE EXCEPTION 'OUTSIDE_WINDOW: The client asked for this exact time. Offer an alternate instead.';
      END IF;
      IF r.flexibility = 'window' AND (p_confirm_time < r.earliest_time
          OR p_confirm_time + make_interval(mins => st.duration_minutes) > r.latest_time) THEN
        RAISE EXCEPTION 'OUTSIDE_WINDOW: That time is outside the client''s availability window. Offer an alternate instead.';
      END IF;
      v_time := p_confirm_time; v_outcome := 'within_window';
    ELSE
      v_time := r.preferred_time; v_outcome := 'requested_time';
    END IF;
  END IF;
  IF v_date IS NULL OR v_time IS NULL THEN RAISE EXCEPTION 'Set a date and time before confirming'; END IF;
  IF v_trainer IS NULL THEN RAISE EXCEPTION 'Assign a trainer before confirming'; END IF;
  v_start := (v_date + v_time) AT TIME ZONE 'America/Detroit';
  v_end := v_start + make_interval(mins => st.duration_minutes);

  v_chk := public.pt_check_slot(v_start, v_end, v_trainer, st.default_location_id, NULL, st.format, r.client_user_id, st.id);
  IF (v_chk->>'has_conflict')::boolean THEN
    RAISE EXCEPTION 'UNAVAILABLE: %', v_chk::text;
  END IF;

  v_has_pass := EXISTS (SELECT 1 FROM pt_passes WHERE user_id = r.client_user_id AND format = st.format AND status='active'
    AND sessions_remaining - pt_pass_reserved_count(id) > 0 AND expires_at >= (now() AT TIME ZONE 'America/Detroit')::date);
  v_appt := public.book_pt_appointment(r.client_user_id, st.format, v_start, st.duration_minutes, v_trainer,
    coalesce(r.client_note, r.goals), NULL, NOT v_has_pass, coalesce(st.default_price_cents,0), st.default_location_id, false, NULL);
  UPDATE pt_appointments SET session_type_id = st.id WHERE id = v_appt.id;
  UPDATE training_requests SET request_status='confirmed', appointment_id=v_appt.id,
    confirmed_starts_at = v_start, confirmed_trainer_id = v_trainer, confirmation_outcome = v_outcome,
    resolved_at=now(), resolved_by=auth.uid(), updated_at=now() WHERE id = r.id;
  RETURN jsonb_build_object('appointment_id', v_appt.id, 'already_confirmed', false, 'package_reserved', v_has_pass, 'outcome', v_outcome);
END $function$;
REVOKE EXECUTE ON FUNCTION public.pt_request_confirm(uuid, boolean, time) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_request_confirm(uuid, boolean, time) TO authenticated, service_role;
