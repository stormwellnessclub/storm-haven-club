ALTER TABLE public.pt_appointments
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pass',
  ADD COLUMN IF NOT EXISTS amount_due_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS payment_note text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pt_appointments_payment_status_chk') THEN
    ALTER TABLE public.pt_appointments
      ADD CONSTRAINT pt_appointments_payment_status_chk
      CHECK (payment_status IN ('pass','unpaid','paid','comp'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pt_appointments_unpaid_idx
  ON public.pt_appointments (payment_status, starts_at DESC)
  WHERE payment_status = 'unpaid';

CREATE OR REPLACE FUNCTION public.book_pt_appointment(
  p_user_id uuid,
  p_format pt_format,
  p_starts_at timestamp with time zone,
  p_duration_minutes integer DEFAULT 60,
  p_instructor_id uuid DEFAULT NULL::uuid,
  p_notes text DEFAULT NULL::text,
  p_pass_id uuid DEFAULT NULL::uuid,
  p_unpaid boolean DEFAULT false,
  p_rate_cents integer DEFAULT 0
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
BEGIN
  IF NOT v_is_staff AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized to book for this user';
  END IF;

  IF p_unpaid THEN
    IF NOT v_is_staff THEN
      RAISE EXCEPTION 'Only staff can book an unpaid session';
    END IF;

    INSERT INTO public.pt_appointments (
      user_id, pass_id, usage_id, instructor_id, format,
      starts_at, ends_at, duration_minutes, notes,
      booked_by_admin_id, payment_status, amount_due_cents
    ) VALUES (
      p_user_id, NULL, NULL, p_instructor_id, p_format,
      p_starts_at, p_starts_at + (p_duration_minutes || ' minutes')::interval, p_duration_minutes, p_notes,
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
  VALUES (v_pass.id, p_starts_at, CASE WHEN v_is_staff THEN v_admin END, COALESCE('Booked appointment'::text, p_notes))
  RETURNING * INTO v_usage;

  UPDATE public.pt_passes
     SET sessions_remaining = sessions_remaining - 1,
         status = CASE WHEN sessions_remaining - 1 = 0 THEN 'exhausted'::pt_pass_status ELSE status END,
         updated_at = now()
   WHERE id = v_pass.id;

  INSERT INTO public.pt_appointments (
    user_id, pass_id, usage_id, instructor_id, format,
    starts_at, ends_at, duration_minutes, notes,
    booked_by_admin_id, payment_status
  ) VALUES (
    p_user_id, v_pass.id, v_usage.id, p_instructor_id, p_format,
    p_starts_at, p_starts_at + (p_duration_minutes || ' minutes')::interval, p_duration_minutes, p_notes,
    CASE WHEN v_is_staff THEN v_admin END, 'pass'
  )
  RETURNING * INTO v_appt;

  RETURN v_appt;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_pt_session_payment(
  p_appointment_id uuid,
  p_payment_status text,
  p_amount_cents integer DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_stripe_payment_intent_id text DEFAULT NULL
)
RETURNS public.pt_appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_appt public.pt_appointments;
BEGIN
  IF NOT has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role,'front_desk'::app_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_payment_status NOT IN ('pass','unpaid','paid','comp') THEN
    RAISE EXCEPTION 'Invalid payment status';
  END IF;

  UPDATE public.pt_appointments
     SET payment_status = p_payment_status,
         amount_due_cents = COALESCE(p_amount_cents, amount_due_cents),
         payment_method = COALESCE(p_payment_method, payment_method),
         payment_note = COALESCE(p_note, payment_note),
         stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
         paid_at = CASE WHEN p_payment_status IN ('paid','comp') THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = p_appointment_id
  RETURNING * INTO v_appt;

  IF v_appt.id IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;
  RETURN v_appt;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_pt_session_payment(uuid, text, integer, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_pt_session_payment(uuid, text, integer, text, text, text) TO authenticated;