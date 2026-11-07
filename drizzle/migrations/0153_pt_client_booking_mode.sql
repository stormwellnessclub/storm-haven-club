-- Club-wide and per-trainer control over what PT clients (members and non-members) can do online.
-- Default is OFF. Instant booking stays unavailable until pt_instant_booking_ready() returns true (Phase 2D.3).

CREATE TABLE public.pt_client_booking_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  client_booking_mode text NOT NULL DEFAULT 'off' CHECK (client_booking_mode IN ('off','request','instant')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.pt_client_booking_settings TO authenticated;
GRANT ALL ON public.pt_client_booking_settings TO service_role;
ALTER TABLE public.pt_client_booking_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read pt client booking settings" ON public.pt_client_booking_settings
  FOR SELECT TO authenticated USING (public.pt_is_staff_or_desk(auth.uid()));

CREATE TABLE public.pt_trainer_client_booking (
  instructor_id uuid PRIMARY KEY REFERENCES public.instructors(id) ON DELETE CASCADE,
  client_booking_mode text NOT NULL DEFAULT 'follow' CHECK (client_booking_mode IN ('follow','hidden','request','instant')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.pt_trainer_client_booking TO authenticated;
GRANT ALL ON public.pt_trainer_client_booking TO service_role;
ALTER TABLE public.pt_trainer_client_booking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read pt trainer client booking" ON public.pt_trainer_client_booking
  FOR SELECT TO authenticated USING (public.pt_is_staff_or_desk(auth.uid()));

-- Flip to true only when 2D.3 availability enforcement is complete.
CREATE OR REPLACE FUNCTION public.pt_instant_booking_ready()
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT false $$;

-- Canonical PT client identity: an account with a PT profile, package or appointment. Membership not required.
CREATE OR REPLACE FUNCTION public.pt_is_client(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.pt_client_profiles p WHERE p.user_id = _uid AND coalesce(p.status,'active') <> 'archived')
    OR EXISTS (SELECT 1 FROM public.pt_passes s WHERE s.user_id = _uid)
    OR EXISTS (SELECT 1 FROM public.pt_appointments a WHERE a.user_id = _uid))
$$;

CREATE OR REPLACE FUNCTION public.pt_is_pt_trainer(_instructor_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.instructors i WHERE i.id = _instructor_id AND i.is_active AND (
    i.is_public_pt
    OR EXISTS (SELECT 1 FROM public.pt_client_trainers t WHERE t.instructor_id = i.id AND t.ended_at IS NULL)
    OR EXISTS (SELECT 1 FROM public.pt_trainer_availability v WHERE v.instructor_id = i.id)
    OR EXISTS (SELECT 1 FROM public.pt_appointments a WHERE a.instructor_id = i.id AND a.starts_at > now() - interval '180 days')))
$$;

-- Effective client mode for a trainer (NULL = any trainer): 'off' | 'request' | 'instant'.
-- Global OFF always wins; instant collapses to off until instant booking is ready.
CREATE OR REPLACE FUNCTION public.pt_effective_client_booking_mode(_instructor_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_global text; v_override text; v_mode text;
BEGIN
  v_global := coalesce((SELECT client_booking_mode FROM public.pt_client_booking_settings WHERE id), 'off');
  IF v_global = 'off' THEN RETURN 'off'; END IF;
  IF _instructor_id IS NULL THEN
    v_mode := v_global;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.instructors WHERE id = _instructor_id AND is_active) THEN RETURN 'off'; END IF;
    v_override := coalesce((SELECT client_booking_mode FROM public.pt_trainer_client_booking WHERE instructor_id = _instructor_id), 'follow');
    IF v_override = 'hidden' THEN RETURN 'off'; END IF;
    IF v_override = 'follow' THEN
      IF NOT public.pt_is_pt_trainer(_instructor_id) THEN RETURN 'off'; END IF;
      v_mode := v_global;
    ELSE
      v_mode := v_override;
    END IF;
  END IF;
  IF v_mode = 'instant' AND NOT public.pt_instant_booking_ready() THEN RETURN 'off'; END IF;
  RETURN v_mode;
END $$;

-- Raises unless the signed-in caller is a PT client allowed to request with this trainer.
CREATE OR REPLACE FUNCTION public.pt_assert_client_request_allowed(_instructor_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to request a session'; END IF;
  IF NOT public.pt_is_client(auth.uid()) THEN
    RAISE EXCEPTION 'REQUESTS_CLOSED: Session requests are for current personal training clients. Please contact the club.';
  END IF;
  IF public.pt_effective_client_booking_mode(_instructor_id) <> 'request' THEN
    RAISE EXCEPTION 'REQUESTS_CLOSED: Online session requests are not open right now. Please contact the club.';
  END IF;
END $$;

-- What the signed-in client may do. Never exposes trainer schedules or availability.
CREATE OR REPLACE FUNCTION public.pt_my_client_booking()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_client boolean; v_any text; v_trainers jsonb := '[]'::jsonb;
BEGIN
  v_client := public.pt_is_client(v_uid);
  IF NOT v_client THEN
    RETURN jsonb_build_object('is_client', false, 'any_trainer_mode', 'off', 'trainers', '[]'::jsonb);
  END IF;
  v_any := public.pt_effective_client_booking_mode(NULL);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'mode', x.mode) ORDER BY x.name), '[]'::jsonb)
    INTO v_trainers
  FROM (SELECT i.id, trim(coalesce(i.first_name,'')||' '||coalesce(i.last_name,'')) AS name,
               public.pt_effective_client_booking_mode(i.id) AS mode
        FROM public.instructors i WHERE i.is_active) x
  WHERE x.mode <> 'off';
  RETURN jsonb_build_object('is_client', true, 'any_trainer_mode', v_any, 'trainers', v_trainers);
END $$;

CREATE OR REPLACE FUNCTION public.pt_client_booking_admin_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.pt_is_staff_or_desk(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN jsonb_build_object(
    'global_mode', coalesce((SELECT client_booking_mode FROM public.pt_client_booking_settings WHERE id), 'off'),
    'instant_ready', public.pt_instant_booking_ready(),
    'trainers', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'name', trim(coalesce(i.first_name,'')||' '||coalesce(i.last_name,'')),
        'is_pt_trainer', public.pt_is_pt_trainer(i.id),
        'override', coalesce(o.client_booking_mode, 'follow'),
        'effective', public.pt_effective_client_booking_mode(i.id))
        ORDER BY public.pt_is_pt_trainer(i.id) DESC, i.first_name, i.last_name)
      FROM public.instructors i LEFT JOIN public.pt_trainer_client_booking o ON o.instructor_id = i.id
      WHERE i.is_active), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.pt_set_client_booking_mode(p_mode text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.pt_is_staff(auth.uid()) THEN RAISE EXCEPTION 'Only a manager or admin can change client booking'; END IF;
  IF p_mode NOT IN ('off','request','instant') THEN RAISE EXCEPTION 'Unknown booking mode'; END IF;
  INSERT INTO public.pt_client_booking_settings (id, client_booking_mode, updated_at, updated_by)
  VALUES (true, p_mode, now(), auth.uid())
  ON CONFLICT (id) DO UPDATE SET client_booking_mode = EXCLUDED.client_booking_mode, updated_at = now(), updated_by = auth.uid();
  RETURN p_mode;
END $$;

CREATE OR REPLACE FUNCTION public.pt_set_trainer_client_booking_mode(p_instructor_id uuid, p_mode text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.pt_is_staff(auth.uid()) THEN RAISE EXCEPTION 'Only a manager or admin can change client booking'; END IF;
  IF p_mode NOT IN ('follow','hidden','request','instant') THEN RAISE EXCEPTION 'Unknown booking mode'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.instructors WHERE id = p_instructor_id) THEN RAISE EXCEPTION 'Trainer not found'; END IF;
  INSERT INTO public.pt_trainer_client_booking (instructor_id, client_booking_mode, updated_at, updated_by)
  VALUES (p_instructor_id, p_mode, now(), auth.uid())
  ON CONFLICT (instructor_id) DO UPDATE SET client_booking_mode = EXCLUDED.client_booking_mode, updated_at = now(), updated_by = auth.uid();
  RETURN p_mode;
END $$;

REVOKE EXECUTE ON FUNCTION public.pt_is_client(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_is_client(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.pt_is_pt_trainer(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_is_pt_trainer(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.pt_effective_client_booking_mode(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_effective_client_booking_mode(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.pt_assert_client_request_allowed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_assert_client_request_allowed(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.pt_my_client_booking() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_my_client_booking() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.pt_client_booking_admin_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_client_booking_admin_state() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.pt_set_client_booking_mode(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_set_client_booking_mode(text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.pt_set_trainer_client_booking_mode(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_set_trainer_client_booking_mode(uuid, text) TO authenticated, service_role;

-- Client appointment requests (RPC path) honour the booking mode. Rest of the body is unchanged.
CREATE OR REPLACE FUNCTION public.pt_request_create(p_session_type_id uuid, p_trainer_id uuid, p_preferred_date date, p_preferred_time time without time zone, p_flexibility_note text DEFAULT NULL::text, p_client_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_p record; v_st record; v_id uuid; v_member boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to request a session'; END IF;
  PERFORM public.pt_assert_client_request_allowed(p_trainer_id);
  SELECT * INTO v_st FROM pt_session_types WHERE id = p_session_type_id AND is_active;
  IF v_st.id IS NULL THEN RAISE EXCEPTION 'Unknown session type'; END IF;
  IF p_preferred_date IS NULL OR p_preferred_date < (now() AT TIME ZONE 'America/Detroit')::date THEN RAISE EXCEPTION 'Choose a future date'; END IF;
  SELECT first_name, last_name, email, phone INTO v_p FROM profiles WHERE user_id = v_uid;
  v_member := EXISTS (SELECT 1 FROM members m WHERE m.user_id = v_uid AND m.status <> 'cancelled');
  INSERT INTO training_requests(service, full_name, email, phone, is_member, status, submitted_by_user_id, client_user_id,
    requested_trainer_id, pt_session_type_id, preferred_date, preferred_time, flexibility_note, client_note, request_status)
  VALUES (v_st.name, trim(coalesce(v_p.first_name,'')||' '||coalesce(v_p.last_name,'')), coalesce(v_p.email, public.current_user_email()), coalesce(v_p.phone,''),
    v_member, 'new', v_uid, v_uid, p_trainer_id, p_session_type_id, p_preferred_date, p_preferred_time,
    left(p_flexibility_note, 500), left(p_client_note, 2000), 'requested')
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

-- Direct-insert path: a client-classified appointment request must also pass the booking mode.
-- Public inquiries (no client_user_id) and staff inserts are unaffected.
CREATE OR REPLACE FUNCTION public.pt_request_classify_client()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.client_user_id IS NOT NULL AND NEW.pt_session_type_id IS NOT NULL AND NEW.preferred_date IS NOT NULL
     AND NEW.client_user_id = auth.uid() THEN
    NEW.request_kind := 'appointment_request';
    NEW.origin := 'authenticated_client';
    IF NOT public.pt_is_desk(auth.uid()) THEN
      PERFORM public.pt_assert_client_request_allowed(NEW.requested_trainer_id);
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- Client self-booking requires effective INSTANT mode (impossible until 2D.3) and may never force past conflicts.
-- Staff path and every other line are unchanged.
CREATE OR REPLACE FUNCTION public.book_pt_appointment(p_user_id uuid, p_format pt_format, p_starts_at timestamp with time zone, p_duration_minutes integer DEFAULT 60, p_instructor_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text, p_pass_id uuid DEFAULT NULL::uuid, p_unpaid boolean DEFAULT false, p_rate_cents integer DEFAULT 0, p_location_id uuid DEFAULT NULL::uuid, p_force boolean DEFAULT false)
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
  IF NOT COALESCE(p_force, false) AND (p_instructor_id IS NOT NULL OR p_location_id IS NOT NULL) THEN
    v_conflict := public.pt_check_appointment_conflict(p_starts_at, v_ends_at, p_instructor_id, p_location_id, NULL, p_format);
    IF (v_conflict->>'has_conflict')::boolean THEN
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
    RETURN v_appt;
  END IF;

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

  RETURN v_appt;
END $function$;