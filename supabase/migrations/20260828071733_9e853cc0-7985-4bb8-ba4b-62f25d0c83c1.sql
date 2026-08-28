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
  v_res jsonb;
BEGIN
  IF NOT v_is_staff AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized to book for this user';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pt_appointments a
    WHERE a.user_id = p_user_id
      AND a.starts_at = p_starts_at
      AND a.ends_at = v_ends_at
      AND a.status NOT IN ('cancelled','late_cancel','no_show')
  ) THEN
    RAISE EXCEPTION 'ALREADY_BOOKED: This client is already booked for that time.';
  END IF;

  IF NOT COALESCE(p_force, false) AND (p_instructor_id IS NOT NULL OR p_location_id IS NOT NULL) THEN
    v_conflict := public.pt_check_appointment_conflict(p_starts_at, v_ends_at, p_instructor_id, p_location_id, NULL, p_format);
    IF (v_conflict->>'has_conflict')::boolean THEN
      IF COALESCE((v_conflict->>'group_full')::boolean, false) THEN
        RAISE EXCEPTION 'GROUP_FULL: Semi-private session is full (% of %).',
          v_conflict->>'group_count', v_conflict->>'group_capacity';
      END IF;
      RAISE EXCEPTION 'CONFLICT: %', v_conflict::text;
    END IF;
  END IF;

  IF p_unpaid THEN
    IF NOT v_is_staff THEN
      RAISE EXCEPTION 'Only staff can book an unpaid session';
    END IF;

    INSERT INTO public.pt_appointments (
      user_id, pass_id, usage_id, instructor_id, location_id, format,
      starts_at, ends_at, duration_minutes, notes,
      booked_by_admin_id, payment_status, amount_due_cents
    ) VALUES (
      p_user_id, NULL, NULL, p_instructor_id, p_location_id, p_format,
      p_starts_at, v_ends_at, p_duration_minutes, p_notes,
      v_admin, 'unpaid', GREATEST(COALESCE(p_rate_cents, 0), 0)
    )
    RETURNING * INTO v_appt;

    RETURN v_appt;
  END IF;

  IF p_pass_id IS NOT NULL THEN
    SELECT * INTO v_pass FROM public.pt_passes
     WHERE id = p_pass_id AND user_id = p_user_id
       AND status = 'active' AND sessions_remaining > 0
       AND expires_at >= (now() AT TIME ZONE 'America/Detroit')::date
     FOR UPDATE;
  ELSE
    SELECT * INTO v_pass FROM public.pt_passes
     WHERE user_id = p_user_id AND format = p_format
       AND status = 'active' AND sessions_remaining > 0
       AND expires_at >= (now() AT TIME ZONE 'America/Detroit')::date
     ORDER BY expires_at ASC, created_at ASC
     LIMIT 1
     FOR UPDATE;
  END IF;

  IF v_pass.id IS NULL THEN
    RAISE EXCEPTION 'NO_SESSIONS: This customer has no active % sessions remaining. Sell a pack first.', p_format;
  END IF;

  INSERT INTO public.pt_appointments (
    user_id, pass_id, usage_id, instructor_id, location_id, format,
    starts_at, ends_at, duration_minutes, notes,
    booked_by_admin_id, payment_status, package_deducted, package_deducted_at
  ) VALUES (
    p_user_id, v_pass.id, NULL, p_instructor_id, p_location_id, p_format,
    p_starts_at, v_ends_at, p_duration_minutes, p_notes,
    CASE WHEN v_is_staff THEN v_admin END, 'pass', true, now()
  )
  RETURNING * INTO v_appt;

  v_res := public.pt_apply_session_delta(
    p_pass_id => v_pass.id,
    p_delta => -1,
    p_event_type => 'session_used',
    p_reason => 'Booked appointment',
    p_appointment_id => v_appt.id,
    p_idempotency_key => 'appt_book:' || v_appt.id::text,
    p_actor => CASE WHEN v_is_staff THEN v_admin END,
    p_used_at => p_starts_at
  );

  UPDATE public.pt_appointments
     SET usage_id = (v_res->>'usage_id')::uuid
   WHERE id = v_appt.id
  RETURNING * INTO v_appt;

  RETURN v_appt;
END;
$function$;