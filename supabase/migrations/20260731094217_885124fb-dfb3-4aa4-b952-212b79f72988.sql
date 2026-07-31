-- 1. Remove the stale 7-arg overload (ambiguous function resolution risk)
DROP FUNCTION IF EXISTS public.book_pt_appointment(uuid, pt_format, timestamptz, integer, uuid, text, uuid);

-- 2. Replace booking function: flags package_deducted + conflict detection
DROP FUNCTION IF EXISTS public.book_pt_appointment(uuid, pt_format, timestamptz, integer, uuid, text, uuid, boolean, integer);

CREATE OR REPLACE FUNCTION public.book_pt_appointment(
  p_user_id uuid,
  p_format pt_format,
  p_starts_at timestamptz,
  p_duration_minutes integer DEFAULT 60,
  p_instructor_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_pass_id uuid DEFAULT NULL,
  p_unpaid boolean DEFAULT false,
  p_rate_cents integer DEFAULT 0,
  p_location_id uuid DEFAULT NULL,
  p_force boolean DEFAULT false
)
RETURNS pt_appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pass public.pt_passes;
  v_usage public.pt_session_usage;
  v_appt public.pt_appointments;
  v_admin uuid := auth.uid();
  v_is_staff boolean := has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role,'front_desk'::app_role]);
  v_ends_at timestamptz := p_starts_at + (p_duration_minutes || ' minutes')::interval;
  v_conflict jsonb;
BEGIN
  IF NOT v_is_staff AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized to book for this user';
  END IF;

  IF NOT COALESCE(p_force, false) AND (p_instructor_id IS NOT NULL OR p_location_id IS NOT NULL) THEN
    v_conflict := public.pt_check_appointment_conflict(p_starts_at, v_ends_at, p_instructor_id, p_location_id, NULL);
    IF (v_conflict->>'has_conflict')::boolean THEN
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

  INSERT INTO public.pt_session_usage (pass_id, used_at, used_by_admin_id, notes)
  VALUES (v_pass.id, p_starts_at, CASE WHEN v_is_staff THEN v_admin END, 'Booked appointment')
  RETURNING * INTO v_usage;

  UPDATE public.pt_passes
     SET sessions_remaining = sessions_remaining - 1,
         status = CASE WHEN sessions_remaining - 1 = 0 THEN 'exhausted'::pt_pass_status ELSE status END,
         updated_at = now()
   WHERE id = v_pass.id;

  INSERT INTO public.pt_appointments (
    user_id, pass_id, usage_id, instructor_id, location_id, format,
    starts_at, ends_at, duration_minutes, notes,
    booked_by_admin_id, payment_status, package_deducted, package_deducted_at
  ) VALUES (
    p_user_id, v_pass.id, v_usage.id, p_instructor_id, p_location_id, p_format,
    p_starts_at, v_ends_at, p_duration_minutes, p_notes,
    CASE WHEN v_is_staff THEN v_admin END, 'pass', true, now()
  )
  RETURNING * INTO v_appt;

  RETURN v_appt;
END;
$function$;

REVOKE ALL ON FUNCTION public.book_pt_appointment(uuid, pt_format, timestamptz, integer, uuid, text, uuid, boolean, integer, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_pt_appointment(uuid, pt_format, timestamptz, integer, uuid, text, uuid, boolean, integer, uuid, boolean) TO authenticated, service_role;

-- 3. Real credit deduct/restore that moves the balance
CREATE OR REPLACE FUNCTION public.pt_set_package_deduction(p_appointment_id uuid, p_deduct boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_appt public.pt_appointments%ROWTYPE;
  v_pass public.pt_passes%ROWTYPE;
BEGIN
  IF NOT public.pt_is_staff_or_desk(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_appt FROM public.pt_appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;

  IF p_deduct THEN
    IF COALESCE(v_appt.package_deducted, false) THEN
      RETURN jsonb_build_object('success', true, 'changed', false);
    END IF;

    IF v_appt.pass_id IS NOT NULL THEN
      SELECT * INTO v_pass FROM public.pt_passes WHERE id = v_appt.pass_id FOR UPDATE;
    ELSE
      SELECT * INTO v_pass FROM public.pt_passes
      WHERE user_id = v_appt.user_id AND status = 'active' AND sessions_remaining > 0
        AND (expires_at IS NULL OR expires_at >= (now() AT TIME ZONE 'America/Detroit')::date)
      ORDER BY expires_at NULLS LAST, created_at
      LIMIT 1 FOR UPDATE;
    END IF;

    IF v_pass.id IS NULL OR COALESCE(v_pass.sessions_remaining, 0) <= 0 THEN
      RAISE EXCEPTION 'NO_SESSIONS: no package session available for this client';
    END IF;

    UPDATE public.pt_passes
       SET sessions_remaining = sessions_remaining - 1,
           status = CASE WHEN sessions_remaining - 1 <= 0 THEN 'exhausted'::pt_pass_status ELSE status END,
           updated_at = now()
     WHERE id = v_pass.id;

    INSERT INTO public.pt_session_usage (pass_id, used_at, used_by_admin_id, notes)
    VALUES (v_pass.id, COALESCE(v_appt.starts_at, now()), auth.uid(), 'Manual credit deduction');

    UPDATE public.pt_appointments
       SET package_deducted = true, package_deducted_at = now(),
           pass_id = COALESCE(pass_id, v_pass.id), updated_at = now()
     WHERE id = p_appointment_id;
  ELSE
    IF NOT COALESCE(v_appt.package_deducted, false) THEN
      RETURN jsonb_build_object('success', true, 'changed', false);
    END IF;

    IF v_appt.pass_id IS NULL THEN
      RAISE EXCEPTION 'No package linked to this session';
    END IF;

    SELECT * INTO v_pass FROM public.pt_passes WHERE id = v_appt.pass_id FOR UPDATE;

    UPDATE public.pt_passes
       SET sessions_remaining = LEAST(sessions_remaining + 1, COALESCE(sessions_total, sessions_remaining + 1)),
           status = CASE WHEN status = 'exhausted' THEN 'active'::pt_pass_status ELSE status END,
           updated_at = now()
     WHERE id = v_pass.id;

    IF v_appt.usage_id IS NOT NULL THEN
      DELETE FROM public.pt_session_usage WHERE id = v_appt.usage_id;
    ELSE
      DELETE FROM public.pt_session_usage
       WHERE id = (
         SELECT id FROM public.pt_session_usage
          WHERE pass_id = v_pass.id
          ORDER BY used_at DESC, created_at DESC
          LIMIT 1
       );
    END IF;

    UPDATE public.pt_appointments
       SET package_deducted = false, package_deducted_at = NULL, usage_id = NULL, updated_at = now()
     WHERE id = p_appointment_id;
  END IF;

  SELECT * INTO v_pass FROM public.pt_passes WHERE id = COALESCE(v_appt.pass_id, v_pass.id);

  RETURN jsonb_build_object(
    'success', true, 'changed', true,
    'sessions_remaining', v_pass.sessions_remaining,
    'pass_name', v_pass.pack_name
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.pt_set_package_deduction(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_set_package_deduction(uuid, boolean) TO authenticated, service_role;

-- 4. Backfill: pass-booked sessions already consumed a credit at booking time
UPDATE public.pt_appointments
   SET package_deducted = true,
       package_deducted_at = COALESCE(package_deducted_at, created_at)
 WHERE pass_id IS NOT NULL AND package_deducted = false;