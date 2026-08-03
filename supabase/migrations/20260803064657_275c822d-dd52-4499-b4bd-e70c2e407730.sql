ALTER TABLE public.pt_appointments ADD COLUMN IF NOT EXISTS cancel_credit_outcome text;

ALTER TABLE public.pt_appointments DROP CONSTRAINT IF EXISTS pt_appointments_payment_status_chk;
ALTER TABLE public.pt_appointments ADD CONSTRAINT pt_appointments_payment_status_chk
  CHECK (payment_status = ANY (ARRAY['pass'::text,'unpaid'::text,'paid'::text,'comp'::text,'cancelled'::text]));

CREATE OR REPLACE FUNCTION public.cancel_pt_appointment(p_appointment_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS pt_appointments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_appt public.pt_appointments;
  v_is_staff boolean := has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role,'front_desk'::app_role]);
  v_free boolean;
  v_outcome text;
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
    v_outcome := 'credited';
  ELSIF NOT v_free THEN
    v_outcome := 'late_no_credit';
  ELSE
    v_outcome := 'no_credit';
  END IF;

  UPDATE public.pt_appointments
     SET status = CASE WHEN v_free THEN 'cancelled'::pt_appointment_status ELSE 'late_cancel'::pt_appointment_status END,
         cancelled_at = now(),
         cancelled_by = auth.uid(),
         cancel_reason = p_reason,
         cancel_credit_outcome = v_outcome,
         payment_status = CASE
           WHEN v_free AND v_appt.pass_id IS NULL AND v_appt.payment_status = 'unpaid' THEN 'cancelled'
           ELSE v_appt.payment_status END,
         amount_due_cents = CASE
           WHEN v_free AND v_appt.pass_id IS NULL AND v_appt.payment_status = 'unpaid' THEN 0
           ELSE v_appt.amount_due_cents END,
         updated_at = now()
   WHERE id = p_appointment_id
   RETURNING * INTO v_appt;

  RETURN v_appt;
END;
$function$;