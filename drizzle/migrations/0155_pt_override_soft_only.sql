-- Availability overrides may bypass only SOFT conflicts (outside hours / time off).
-- HARD collisions (trainer, client, room overlap, group full) always block, even with p_force.
CREATE OR REPLACE FUNCTION public.pt_slot_hard_conflict(p jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_array_length(coalesce(p->'trainer_conflicts','[]'::jsonb)) > 0
      OR jsonb_array_length(coalesce(p->'client_conflicts','[]'::jsonb)) > 0
      OR jsonb_array_length(coalesce(p->'room_conflicts','[]'::jsonb)) > 0
      OR coalesce((p->>'group_full')::boolean, false)
$$;
REVOKE EXECUTE ON FUNCTION public.pt_slot_hard_conflict(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_slot_hard_conflict(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.book_pt_appointment(p_user_id uuid, p_format pt_format, p_starts_at timestamp with time zone, p_duration_minutes integer DEFAULT 60, p_instructor_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text, p_pass_id uuid DEFAULT NULL::uuid, p_unpaid boolean DEFAULT false, p_rate_cents integer DEFAULT 0, p_location_id uuid DEFAULT NULL::uuid, p_force boolean DEFAULT false, p_override_reason text DEFAULT NULL::text)
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
    IF COALESCE((v_conflict->>'group_full')::boolean, false) THEN
      RAISE EXCEPTION 'GROUP_FULL: Semi-private session is full (% of %).', v_conflict->>'group_count', v_conflict->>'group_capacity';
    END IF;
    IF public.pt_slot_hard_conflict(v_conflict) THEN
      RAISE EXCEPTION 'CONFLICT: %', v_conflict::text;
    END IF;
    IF NOT COALESCE(p_force, false) THEN
      RAISE EXCEPTION 'CONFLICT: %', v_conflict::text;
    END IF;
    IF NOT has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role]) THEN
      RAISE EXCEPTION 'OVERRIDE_NOT_ALLOWED: Only an admin or manager can book outside availability.';
    END IF;
    IF NULLIF(btrim(coalesce(p_override_reason,'')), '') IS NULL THEN
      RAISE EXCEPTION 'OVERRIDE_REASON_REQUIRED: Add a reason to book outside availability.';
    END IF;
    v_override := true;
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

CREATE OR REPLACE FUNCTION public.pt_reschedule_appointment(p_appointment_id uuid, p_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_duration_minutes integer DEFAULT NULL::integer, p_instructor_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid, p_force boolean DEFAULT false, p_reason text DEFAULT NULL::text, p_clear_instructor boolean DEFAULT false, p_override_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_appt pt_appointments%ROWTYPE; v_start timestamptz; v_dur integer; v_end timestamptz;
  v_instructor uuid; v_location uuid; v_conflict jsonb; v_has boolean; v_hard boolean; v_ovr text;
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
  v_hard := v_has AND public.pt_slot_hard_conflict(v_conflict);

  IF v_hard THEN RETURN jsonb_build_object('success', false, 'hard', true, 'conflict', v_conflict); END IF;
  IF v_has AND NOT p_force THEN RETURN jsonb_build_object('success', false, 'hard', false, 'conflict', v_conflict); END IF;
  IF v_has THEN
    IF NOT public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager']::app_role[]) THEN
      RAISE EXCEPTION 'OVERRIDE_NOT_ALLOWED: Only an admin or manager can move a session outside availability.';
    END IF;
    v_ovr := NULLIF(btrim(coalesce(p_override_reason, '')), '');
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