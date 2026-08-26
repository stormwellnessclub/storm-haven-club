CREATE OR REPLACE FUNCTION public.cancel_pt_appointment(p_appointment_id uuid, p_reason text DEFAULT NULL::text, p_outcome text DEFAULT NULL::text, p_override_reason text DEFAULT NULL::text)
 RETURNS pt_appointments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_appt public.pt_appointments%ROWTYPE;
  v_is_staff boolean := public.pt_is_staff_or_desk(auth.uid());
  v_policy text;
  v_final text;
  v_consumes boolean;
  v_usage public.pt_session_usage%ROWTYPE;
  v_pass_id uuid;
  v_res jsonb;
  v_credit_outcome text;
  v_overridden boolean := false;
BEGIN
  SELECT * INTO v_appt FROM public.pt_appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;

  IF NOT v_is_staff AND v_appt.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to cancel this appointment';
  END IF;

  IF v_appt.status NOT IN ('scheduled') THEN
    RAISE EXCEPTION 'Appointment already %', v_appt.status;
  END IF;

  -- Policy outcome
  IF v_is_staff THEN
    v_policy := 'staff_cancel';
  ELSIF now() <= v_appt.starts_at - interval '24 hours' THEN
    v_policy := 'timely_client_cancel';
  ELSE
    v_policy := 'late_client_cancel';
  END IF;

  v_final := COALESCE(NULLIF(btrim(COALESCE(p_outcome, '')), ''), v_policy);

  -- A no-show is its own first-class outcome, not an override of the policy
  -- result: staff record it directly and the actor/timestamp are still stored.
  IF v_final <> v_policy AND NOT (v_final = 'no_show' AND v_is_staff) THEN
    IF NOT v_is_staff THEN
      RAISE EXCEPTION 'Not authorized to override the cancellation outcome';
    END IF;
    IF COALESCE(btrim(COALESCE(p_override_reason, '')), '') = '' THEN
      RAISE EXCEPTION 'An override reason is required to change the cancellation outcome';
    END IF;
    v_overridden := true;
  END IF;

  IF v_final NOT IN ('timely_client_cancel','late_client_cancel','no_show','staff_cancel','facility_cancel','admin_override_credit','admin_override_consume') THEN
    RAISE EXCEPTION 'Unknown cancellation outcome: %', v_final;
  END IF;

  v_consumes := public.pt_cancel_outcome_consumes(v_final) OR v_final = 'admin_override_consume';

  IF v_consumes THEN
    IF COALESCE(v_appt.package_deducted, false) THEN
      v_credit_outcome := 'consumed';
    ELSE
      v_pass_id := public.pt_pick_pass_for_appointment(v_appt);
      IF v_pass_id IS NOT NULL THEN
        v_res := public.pt_apply_session_delta(
          p_pass_id => v_pass_id,
          p_delta => -1,
          p_event_type => 'session_used',
          p_reason => 'Session consumed — ' || v_final || COALESCE(': ' || p_reason, ''),
          p_appointment_id => p_appointment_id,
          p_idempotency_key => 'appt_cancel_consume:' || p_appointment_id::text,
          p_actor => auth.uid()
        );
        UPDATE public.pt_appointments
           SET package_deducted = true,
               package_deducted_at = COALESCE(package_deducted_at, now()),
               pass_id = COALESCE(pass_id, v_pass_id),
               usage_id = COALESCE(usage_id, NULLIF(v_res->>'usage_id','')::uuid)
         WHERE id = p_appointment_id;
        v_credit_outcome := 'consumed';
      ELSE
        v_credit_outcome := 'no_credit';
      END IF;
    END IF;
  ELSE
    IF COALESCE(v_appt.package_deducted, false) AND v_appt.pass_id IS NOT NULL THEN
      SELECT * INTO v_usage FROM public.pt_session_usage
        WHERE appointment_id = p_appointment_id AND quantity < 0 AND reversed_at IS NULL
        ORDER BY created_at DESC LIMIT 1;

      v_res := public.pt_apply_session_delta(
        p_pass_id => v_appt.pass_id,
        p_delta => 1,
        p_event_type => 'session_restored',
        p_reason => 'Session restored — ' || v_final || COALESCE(': ' || p_reason, ''),
        p_appointment_id => p_appointment_id,
        p_idempotency_key => 'appt_cancel_restore:' || p_appointment_id::text,
        p_reverses_usage_id => v_usage.id,
        p_actor => auth.uid()
      );
      UPDATE public.pt_appointments
         SET package_deducted = false, package_deducted_at = NULL, usage_id = NULL
       WHERE id = p_appointment_id;
      v_credit_outcome := 'credited';
    ELSE
      v_credit_outcome := 'no_credit';
    END IF;
  END IF;

  UPDATE public.pt_appointments
     SET status = CASE
                    WHEN v_final = 'no_show' THEN 'no_show'::pt_appointment_status
                    WHEN v_consumes THEN 'late_cancel'::pt_appointment_status
                    ELSE 'cancelled'::pt_appointment_status
                  END,
         cancelled_at = now(),
         cancelled_by = auth.uid(),
         cancel_reason = p_reason,
         cancel_credit_outcome = v_credit_outcome,
         cancel_policy_outcome = v_policy,
         cancel_outcome_reason = v_final,
         cancel_override_by = CASE WHEN v_overridden THEN auth.uid() ELSE NULL END,
         cancel_override_reason = CASE WHEN v_overridden THEN p_override_reason ELSE NULL END,
         cancel_overridden_at = CASE WHEN v_overridden THEN now() ELSE NULL END,
         no_show_consumed = (v_final = 'no_show' AND v_credit_outcome = 'consumed'),
         payment_status = CASE
           WHEN NOT v_consumes AND v_appt.pass_id IS NULL AND v_appt.payment_status = 'unpaid' THEN 'cancelled'
           ELSE v_appt.payment_status END,
         amount_due_cents = CASE
           WHEN NOT v_consumes AND v_appt.pass_id IS NULL AND v_appt.payment_status = 'unpaid' THEN 0
           ELSE v_appt.amount_due_cents END,
         updated_at = now()
   WHERE id = p_appointment_id
  RETURNING * INTO v_appt;

  RETURN v_appt;
END;
$function$;