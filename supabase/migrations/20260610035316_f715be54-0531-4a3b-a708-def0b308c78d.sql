
-- Status enum for appointments
DO $$ BEGIN
  CREATE TYPE pt_appointment_status AS ENUM ('scheduled','completed','cancelled','late_cancel','no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.pt_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pass_id uuid REFERENCES public.pt_passes(id) ON DELETE SET NULL,
  usage_id uuid REFERENCES public.pt_session_usage(id) ON DELETE SET NULL,
  instructor_id uuid REFERENCES public.instructors(id) ON DELETE SET NULL,
  format pt_format NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  status pt_appointment_status NOT NULL DEFAULT 'scheduled',
  notes text,
  cancel_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid,
  booked_by_admin_id uuid,
  confirmation_email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pt_appointments_user_idx ON public.pt_appointments(user_id);
CREATE INDEX pt_appointments_starts_idx ON public.pt_appointments(starts_at);
CREATE INDEX pt_appointments_instructor_idx ON public.pt_appointments(instructor_id);
CREATE INDEX pt_appointments_status_idx ON public.pt_appointments(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_appointments TO authenticated;
GRANT ALL ON public.pt_appointments TO service_role;

ALTER TABLE public.pt_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own PT appointments"
  ON public.pt_appointments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Members cancel own PT appointments"
  ON public.pt_appointments FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff manage PT appointments"
  ON public.pt_appointments FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role,'front_desk'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role,'front_desk'::app_role]));

CREATE TRIGGER pt_appointments_updated_at
  BEFORE UPDATE ON public.pt_appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Book a PT appointment, atomically deducting one session from the
-- soonest-expiring active pack matching the format.
CREATE OR REPLACE FUNCTION public.book_pt_appointment(
  p_user_id uuid,
  p_format pt_format,
  p_starts_at timestamptz,
  p_duration_minutes integer DEFAULT 60,
  p_instructor_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_pass_id uuid DEFAULT NULL
)
RETURNS public.pt_appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF p_pass_id IS NOT NULL THEN
    SELECT * INTO v_pass FROM public.pt_passes
     WHERE id = p_pass_id AND user_id = p_user_id
       AND status = 'active' AND sessions_remaining > 0
       AND expires_at >= (now() AT TIME ZONE 'America/Chicago')::date
     FOR UPDATE;
  ELSE
    SELECT * INTO v_pass FROM public.pt_passes
     WHERE user_id = p_user_id AND format = p_format
       AND status = 'active' AND sessions_remaining > 0
       AND expires_at >= (now() AT TIME ZONE 'America/Chicago')::date
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
    booked_by_admin_id
  ) VALUES (
    p_user_id, v_pass.id, v_usage.id, p_instructor_id, p_format,
    p_starts_at, p_starts_at + (p_duration_minutes || ' minutes')::interval, p_duration_minutes, p_notes,
    CASE WHEN v_is_staff THEN v_admin END
  )
  RETURNING * INTO v_appt;

  RETURN v_appt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_pt_appointment(uuid, pt_format, timestamptz, integer, uuid, text, uuid) TO authenticated;

-- Cancel a PT appointment. Restores the session if >= 24h before start;
-- otherwise records a late cancel and keeps the deduction.
CREATE OR REPLACE FUNCTION public.cancel_pt_appointment(
  p_appointment_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS public.pt_appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt public.pt_appointments;
  v_is_staff boolean := has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role,'front_desk'::app_role]);
  v_free boolean;
BEGIN
  SELECT * INTO v_appt FROM public.pt_appointments WHERE id = p_appointment_id FOR UPDATE;
  IF v_appt.id IS NULL THEN RAISE EXCEPTION 'Appointment not found'; END IF;

  IF NOT v_is_staff AND v_appt.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to cancel this appointment';
  END IF;

  IF v_appt.status NOT IN ('scheduled') THEN
    RAISE EXCEPTION 'Appointment already %', v_appt.status;
  END IF;

  v_free := v_is_staff OR (now() <= v_appt.starts_at - interval '24 hours');

  IF v_free AND v_appt.pass_id IS NOT NULL THEN
    UPDATE public.pt_passes
       SET sessions_remaining = sessions_remaining + 1,
           status = CASE WHEN status = 'exhausted' THEN 'active'::pt_pass_status ELSE status END,
           updated_at = now()
     WHERE id = v_appt.pass_id;
    IF v_appt.usage_id IS NOT NULL THEN
      DELETE FROM public.pt_session_usage WHERE id = v_appt.usage_id;
    END IF;
  END IF;

  UPDATE public.pt_appointments
     SET status = CASE WHEN v_free THEN 'cancelled'::pt_appointment_status ELSE 'late_cancel'::pt_appointment_status END,
         cancelled_at = now(),
         cancelled_by = auth.uid(),
         cancel_reason = p_reason,
         updated_at = now()
   WHERE id = p_appointment_id
   RETURNING * INTO v_appt;

  RETURN v_appt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_pt_appointment(uuid, text) TO authenticated;
