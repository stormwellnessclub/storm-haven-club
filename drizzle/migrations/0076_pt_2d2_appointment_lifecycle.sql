ALTER TABLE public.pt_appointments
  ADD COLUMN IF NOT EXISTS checked_in_by uuid,
  ADD COLUMN IF NOT EXISTS started_by uuid,
  ADD COLUMN IF NOT EXISTS completed_by uuid,
  ADD COLUMN IF NOT EXISTS reschedule_note text;

-- Who may manage a given appointment: managers/admins and front desk for all;
-- trainers only for sessions assigned to them.
CREATE OR REPLACE FUNCTION public.pt_can_manage_appointment(_uid uuid, _instructor_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_any_role(_uid, ARRAY['admin','super_admin','manager','front_desk']::app_role[])
      OR public.pt_request_role() = 'service_role'
      OR (public.has_any_role(_uid, ARRAY['class_instructor']::app_role[])
          AND _instructor_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM public.instructors i WHERE i.id = _instructor_id AND i.user_id = _uid));
$$;

-- Check in (optionally start). Never touches the package ledger.
CREATE OR REPLACE FUNCTION public.pt_check_in_appointment(p_appointment_id uuid, p_start boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_appt public.pt_appointments%ROWTYPE; v_uid uuid := auth.uid();
BEGIN
  SELECT * INTO v_appt FROM public.pt_appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  IF NOT public.pt_can_manage_appointment(v_uid, v_appt.instructor_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_appt.status <> 'scheduled' THEN RAISE EXCEPTION 'Appointment is already %', v_appt.status; END IF;
  UPDATE public.pt_appointments SET
    checked_in_at = COALESCE(checked_in_at, now()),
    checked_in_by = COALESCE(checked_in_by, v_uid),
    started_at = CASE WHEN p_start THEN COALESCE(started_at, now()) ELSE started_at END,
    started_by = CASE WHEN p_start THEN COALESCE(started_by, v_uid) ELSE started_by END,
    confirmation_status = 'confirmed', updated_at = now()
  WHERE id = p_appointment_id;
  RETURN jsonb_build_object('success', true, 'already', v_appt.checked_in_at IS NOT NULL AND (NOT p_start OR v_appt.started_at IS NOT NULL));
END $$;

-- Reschedule / reassign: same row, trainer + room + client overlap checks, reason kept.
DROP FUNCTION IF EXISTS public.pt_reschedule_appointment(uuid, timestamptz, integer, uuid, uuid, boolean);
CREATE FUNCTION public.pt_reschedule_appointment(
  p_appointment_id uuid, p_starts_at timestamptz DEFAULT NULL, p_duration_minutes integer DEFAULT NULL,
  p_instructor_id uuid DEFAULT NULL, p_location_id uuid DEFAULT NULL, p_force boolean DEFAULT false,
  p_reason text DEFAULT NULL, p_clear_instructor boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_appt pt_appointments%ROWTYPE; v_start timestamptz; v_dur integer; v_end timestamptz;
  v_instructor uuid; v_location uuid; v_conflict jsonb; v_client jsonb; v_has boolean;
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

  -- Trainers may not hand a session to another trainer.
  IF v_instructor IS DISTINCT FROM v_appt.instructor_id
     AND NOT public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[]) THEN
    RAISE EXCEPTION 'Only staff can reassign the trainer';
  END IF;

  v_conflict := public.pt_check_appointment_conflict(v_start, v_end, v_instructor, v_location, p_appointment_id);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', o.id, 'starts_at', o.starts_at)), '[]'::jsonb) INTO v_client
    FROM pt_appointments o
   WHERE o.user_id = v_appt.user_id AND o.id <> p_appointment_id AND o.status = 'scheduled'
     AND o.starts_at < v_end AND o.ends_at > v_start;
  v_conflict := v_conflict || jsonb_build_object('client_conflicts', v_client);
  v_has := COALESCE((v_conflict->>'has_conflict')::boolean, false) OR jsonb_array_length(v_client) > 0;
  v_conflict := jsonb_set(v_conflict, '{has_conflict}', to_jsonb(v_has));

  IF v_has AND NOT p_force THEN RETURN jsonb_build_object('success', false, 'conflict', v_conflict); END IF;

  UPDATE pt_appointments SET starts_at = v_start, ends_at = v_end, duration_minutes = v_dur,
    instructor_id = v_instructor, location_id = v_location,
    reschedule_note = NULLIF(btrim(COALESCE(p_reason,'')), ''), updated_at = now()
  WHERE id = p_appointment_id;
  RETURN jsonb_build_object('success', true, 'conflict', v_conflict);
END $$;
GRANT EXECUTE ON FUNCTION public.pt_reschedule_appointment(uuid, timestamptz, integer, uuid, uuid, boolean, text, boolean) TO authenticated;

-- Completion: trainer scoping, cannot complete a cancelled/no-show row, actor recorded.
CREATE OR REPLACE FUNCTION public.pt_complete_session(p_appointment_id uuid, p_note jsonb DEFAULT '{}'::jsonb, p_deduct boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_appt public.pt_appointments%ROWTYPE; v_pass_id uuid; v_uid uuid := auth.uid();
  v_note_id uuid; v_res jsonb; v_deducted boolean := false;
BEGIN
  SELECT * INTO v_appt FROM public.pt_appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  IF NOT public.pt_can_manage_appointment(v_uid, v_appt.instructor_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_appt.status IN ('cancelled','late_cancel','no_show') THEN
    RAISE EXCEPTION 'This appointment is % and cannot be completed', v_appt.status;
  END IF;

  IF v_appt.reservation_state = 'reserved' THEN
    IF p_deduct THEN
      v_res := public.pt_reservation_consume(p_appointment_id, 'Session completed', 'appt_complete:' || p_appointment_id::text, v_uid);
      v_pass_id := v_appt.pass_id;
      v_deducted := NOT COALESCE((v_res->>'duplicate')::boolean, false);
    ELSE
      PERFORM public.pt_reservation_release(p_appointment_id, 'Completed without package deduction', v_uid);
    END IF;
  ELSIF p_deduct AND COALESCE(v_appt.package_deducted, false) = false THEN
    v_pass_id := public.pt_pick_pass_for_appointment(v_appt);
    IF v_pass_id IS NULL THEN RAISE EXCEPTION 'PACKAGE_DEDUCTION_FAILED: no package session available for this client'; END IF;
    v_res := public.pt_apply_session_delta(v_pass_id, -1, 'session_used', 'Session completed', p_appointment_id,
      'appt_complete:' || p_appointment_id::text, NULL, v_uid);
    v_deducted := NOT COALESCE((v_res->>'duplicate')::boolean, false);
  END IF;

  SELECT id INTO v_note_id FROM public.pt_session_notes WHERE appointment_id = p_appointment_id LIMIT 1;
  IF v_note_id IS NULL THEN
    INSERT INTO public.pt_session_notes (appointment_id, user_id, instructor_id, session_date, subjective, objective, observations,
      modifications, pain_discomfort, rpe, homework, next_focus, private_note, client_recap, exercise_log, is_draft, created_by, updated_by)
    VALUES (p_appointment_id, v_appt.user_id, v_appt.instructor_id, (v_appt.starts_at AT TIME ZONE 'America/Detroit')::date,
      p_note->>'subjective', p_note->>'objective', p_note->>'observations', p_note->>'modifications', p_note->>'pain_discomfort',
      NULLIF(p_note->>'rpe','')::numeric, p_note->>'homework', p_note->>'next_focus', p_note->>'private_note', p_note->>'client_recap',
      COALESCE(p_note->'exercise_log', '{}'::jsonb), false, v_uid, v_uid)
    RETURNING id INTO v_note_id;
  ELSE
    UPDATE public.pt_session_notes SET
      subjective = COALESCE(p_note->>'subjective', subjective), objective = COALESCE(p_note->>'objective', objective),
      observations = COALESCE(p_note->>'observations', observations), modifications = COALESCE(p_note->>'modifications', modifications),
      pain_discomfort = COALESCE(p_note->>'pain_discomfort', pain_discomfort), rpe = COALESCE(NULLIF(p_note->>'rpe','')::numeric, rpe),
      homework = COALESCE(p_note->>'homework', homework), next_focus = COALESCE(p_note->>'next_focus', next_focus),
      private_note = COALESCE(p_note->>'private_note', private_note), client_recap = COALESCE(p_note->>'client_recap', client_recap),
      exercise_log = COALESCE(p_note->'exercise_log', exercise_log), is_draft = false, updated_by = v_uid, updated_at = now()
    WHERE id = v_note_id;
  END IF;

  UPDATE public.pt_appointments SET
    status = 'completed'::pt_appointment_status, completed_at = COALESCE(completed_at, now()),
    completed_by = COALESCE(completed_by, v_uid),
    package_deducted = CASE WHEN v_res IS NOT NULL THEN true ELSE package_deducted END,
    package_deducted_at = CASE WHEN v_res IS NOT NULL THEN COALESCE(package_deducted_at, now()) ELSE package_deducted_at END,
    pass_id = COALESCE(pass_id, v_pass_id),
    usage_id = COALESCE(usage_id, NULLIF(v_res->>'usage_id','')::uuid), updated_at = now()
  WHERE id = p_appointment_id;

  RETURN jsonb_build_object('success', true, 'note_id', v_note_id, 'deducted', v_deducted, 'pass_id', v_pass_id,
    'pass_name', v_res->>'pass_name', 'sessions_remaining', NULLIF(v_res->>'sessions_after','')::integer);
END $function$;

-- Manual credit moves are an administrative override: managers only.
CREATE OR REPLACE FUNCTION public.pt_set_package_deduction(p_appointment_id uuid, p_deduct boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_appt public.pt_appointments%ROWTYPE; v_pass_id uuid; v_usage public.pt_session_usage%ROWTYPE; v_res jsonb; v_uid uuid := auth.uid();
BEGIN
  IF NOT public.pt_is_financial_manager(v_uid) THEN RAISE EXCEPTION 'Only a manager or admin can change a session''s package credit'; END IF;
  SELECT * INTO v_appt FROM public.pt_appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;

  IF p_deduct THEN
    IF COALESCE(v_appt.package_deducted, false) THEN RETURN jsonb_build_object('success', true, 'changed', false); END IF;
    IF v_appt.reservation_state = 'reserved' THEN
      v_res := public.pt_reservation_consume(p_appointment_id, 'Manual credit deduction', 'appt_manual_deduct:' || p_appointment_id::text, v_uid);
    ELSE
      v_pass_id := public.pt_pick_pass_for_appointment(v_appt);
      IF v_pass_id IS NULL THEN RAISE EXCEPTION 'NO_SESSIONS: no package session available for this client'; END IF;
      v_res := public.pt_apply_session_delta(v_pass_id, -1, 'session_used', 'Manual credit deduction', p_appointment_id,
        'appt_manual_deduct:' || p_appointment_id::text, NULL, v_uid, COALESCE(v_appt.starts_at, now()));
      UPDATE public.pt_appointments SET package_deducted = true, package_deducted_at = now(), pass_id = COALESCE(pass_id, v_pass_id),
        usage_id = NULLIF(v_res->>'usage_id','')::uuid, updated_at = now() WHERE id = p_appointment_id;
    END IF;
  ELSE
    IF v_appt.reservation_state = 'reserved' THEN
      PERFORM public.pt_reservation_release(p_appointment_id, 'Reservation released by staff', v_uid);
      UPDATE public.pt_appointments SET pass_id = NULL, payment_status = 'unpaid', updated_at = now() WHERE id = p_appointment_id;
      RETURN jsonb_build_object('success', true, 'changed', true);
    END IF;
    IF NOT COALESCE(v_appt.package_deducted, false) THEN RETURN jsonb_build_object('success', true, 'changed', false); END IF;
    IF v_appt.pass_id IS NULL THEN RAISE EXCEPTION 'No package linked to this session'; END IF;
    SELECT * INTO v_usage FROM public.pt_session_usage WHERE appointment_id = p_appointment_id AND quantity < 0 AND reversed_at IS NULL ORDER BY created_at DESC LIMIT 1;
    v_res := public.pt_apply_session_delta(v_appt.pass_id, 1, 'session_restored', 'Manual credit restored by staff', p_appointment_id,
      'appt_manual_restore:' || p_appointment_id::text || ':' || COALESCE(v_usage.id::text, 'none'), v_usage.id, v_uid);
    UPDATE public.pt_appointments SET package_deducted = false, package_deducted_at = NULL, usage_id = NULL, updated_at = now() WHERE id = p_appointment_id;
  END IF;
  RETURN jsonb_build_object('success', true, 'changed', true, 'sessions_remaining', NULLIF(v_res->>'sessions_after','')::integer);
END $function$;

-- After-the-fact override with reason, through the protected ledger.
CREATE OR REPLACE FUNCTION public.pt_override_appointment_consequence(p_appointment_id uuid, p_action text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_res jsonb; v_reason text := btrim(COALESCE(p_reason,''));
BEGIN
  IF NOT public.pt_is_financial_manager(auth.uid()) THEN RAISE EXCEPTION 'Only a manager or admin can override a session outcome'; END IF;
  IF v_reason = '' THEN RAISE EXCEPTION 'A reason is required for an override'; END IF;
  IF p_action = 'restore_credit' THEN
    v_res := public.pt_set_package_deduction(p_appointment_id, false);
  ELSIF p_action = 'consume_credit' THEN
    v_res := public.pt_set_package_deduction(p_appointment_id, true);
  ELSIF p_action = 'waive_charge' THEN
    v_res := public.pt_waive_sessions(ARRAY[p_appointment_id], v_reason);
  ELSE
    RAISE EXCEPTION 'Unknown override: %', p_action;
  END IF;
  UPDATE public.pt_appointments SET cancel_override_by = auth.uid(), cancel_override_reason = p_action || ': ' || v_reason,
    cancel_overridden_at = now(), updated_at = now() WHERE id = p_appointment_id;
  RETURN v_res || jsonb_build_object('action', p_action);
END $$;

-- Cancellation: staff record the real outcome directly; admin overrides need a manager + reason; trainer scoping.
CREATE OR REPLACE FUNCTION public.cancel_pt_appointment(p_appointment_id uuid, p_reason text DEFAULT NULL::text, p_outcome text DEFAULT NULL::text, p_override_reason text DEFAULT NULL::text)
RETURNS pt_appointments LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_appt public.pt_appointments%ROWTYPE;
  v_is_staff boolean;
  v_policy text; v_final text; v_consumes boolean;
  v_usage public.pt_session_usage%ROWTYPE;
  v_pass_id uuid; v_res jsonb; v_credit_outcome text; v_overridden boolean := false;
BEGIN
  SELECT * INTO v_appt FROM public.pt_appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  v_is_staff := public.pt_can_manage_appointment(auth.uid(), v_appt.instructor_id);
  IF NOT v_is_staff AND v_appt.user_id <> auth.uid() THEN RAISE EXCEPTION 'Not authorized to cancel this appointment'; END IF;
  IF v_appt.status NOT IN ('scheduled') THEN RAISE EXCEPTION 'Appointment already %', v_appt.status; END IF;

  IF v_is_staff THEN v_policy := 'staff_cancel';
  ELSIF now() <= v_appt.starts_at - interval '24 hours' THEN v_policy := 'timely_client_cancel';
  ELSE v_policy := 'late_client_cancel'; END IF;

  v_final := COALESCE(NULLIF(btrim(COALESCE(p_outcome, '')), ''), v_policy);
  IF v_final NOT IN ('timely_client_cancel','late_client_cancel','no_show','staff_cancel','facility_cancel','admin_override_credit','admin_override_consume') THEN
    RAISE EXCEPTION 'Unknown cancellation outcome: %', v_final;
  END IF;
  IF v_final <> v_policy THEN
    IF NOT v_is_staff THEN RAISE EXCEPTION 'Not authorized to override the cancellation outcome'; END IF;
    IF v_final IN ('admin_override_credit','admin_override_consume') THEN
      IF NOT public.pt_is_financial_manager(auth.uid()) THEN RAISE EXCEPTION 'Only a manager or admin can apply an administrative override'; END IF;
      IF COALESCE(btrim(COALESCE(p_override_reason, '')), '') = '' THEN
        RAISE EXCEPTION 'An override reason is required for an administrative override';
      END IF;
      v_overridden := true;
    END IF;
  END IF;

  v_consumes := public.pt_cancel_outcome_consumes(v_final) OR v_final = 'admin_override_consume';

  IF v_consumes THEN
    IF COALESCE(v_appt.package_deducted, false) THEN
      v_credit_outcome := 'consumed';
    ELSIF v_appt.reservation_state = 'reserved' THEN
      PERFORM public.pt_reservation_consume(p_appointment_id, 'Session consumed — ' || v_final || COALESCE(': ' || p_reason, ''),
        'appt_cancel_consume:' || p_appointment_id::text, auth.uid());
      v_credit_outcome := 'consumed';
    ELSE
      v_pass_id := public.pt_pick_pass_for_appointment(v_appt);
      IF v_pass_id IS NOT NULL THEN
        v_res := public.pt_apply_session_delta(v_pass_id, -1, 'session_used',
          'Session consumed — ' || v_final || COALESCE(': ' || p_reason, ''), p_appointment_id,
          'appt_cancel_consume:' || p_appointment_id::text, NULL, auth.uid());
        UPDATE public.pt_appointments SET package_deducted = true, package_deducted_at = COALESCE(package_deducted_at, now()),
          pass_id = COALESCE(pass_id, v_pass_id), usage_id = COALESCE(usage_id, NULLIF(v_res->>'usage_id','')::uuid)
         WHERE id = p_appointment_id;
        v_credit_outcome := 'consumed';
      ELSE
        v_credit_outcome := 'no_credit';
      END IF;
    END IF;
  ELSE
    IF v_appt.reservation_state = 'reserved' THEN
      PERFORM public.pt_reservation_release(p_appointment_id, 'Reservation released — ' || v_final || COALESCE(': ' || p_reason, ''), auth.uid());
      v_credit_outcome := 'credited';
    ELSIF COALESCE(v_appt.package_deducted, false) AND v_appt.pass_id IS NOT NULL THEN
      SELECT * INTO v_usage FROM public.pt_session_usage
        WHERE appointment_id = p_appointment_id AND quantity < 0 AND reversed_at IS NULL ORDER BY created_at DESC LIMIT 1;
      v_res := public.pt_apply_session_delta(v_appt.pass_id, 1, 'session_restored',
        'Session restored — ' || v_final || COALESCE(': ' || p_reason, ''), p_appointment_id,
        'appt_cancel_restore:' || p_appointment_id::text, v_usage.id, auth.uid());
      UPDATE public.pt_appointments SET package_deducted = false, package_deducted_at = NULL, usage_id = NULL WHERE id = p_appointment_id;
      v_credit_outcome := 'credited';
    ELSE
      v_credit_outcome := 'no_credit';
    END IF;
  END IF;

  UPDATE public.pt_appointments
     SET status = CASE WHEN v_final = 'no_show' THEN 'no_show'::pt_appointment_status
                       WHEN v_consumes THEN 'late_cancel'::pt_appointment_status
                       ELSE 'cancelled'::pt_appointment_status END,
         cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = p_reason,
         cancel_credit_outcome = v_credit_outcome, cancel_policy_outcome = v_policy, cancel_outcome_reason = v_final,
         cancel_override_by = CASE WHEN v_overridden THEN auth.uid() ELSE NULL END,
         cancel_override_reason = CASE WHEN v_overridden THEN p_override_reason ELSE NULL END,
         cancel_overridden_at = CASE WHEN v_overridden THEN now() ELSE NULL END,
         no_show_at = CASE WHEN v_final = 'no_show' THEN now() ELSE no_show_at END,
         no_show_consumed = (v_final = 'no_show' AND v_credit_outcome = 'consumed'),
         payment_status = CASE WHEN NOT v_consumes AND v_appt.pass_id IS NULL AND v_appt.payment_status = 'unpaid' THEN 'cancelled' ELSE v_appt.payment_status END,
         amount_due_cents = CASE WHEN NOT v_consumes AND v_appt.pass_id IS NULL AND v_appt.payment_status = 'unpaid' THEN 0 ELSE v_appt.amount_due_cents END,
         updated_at = now()
   WHERE id = p_appointment_id
  RETURNING * INTO v_appt;
  RETURN v_appt;
END $function$;

GRANT EXECUTE ON FUNCTION public.pt_can_manage_appointment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pt_check_in_appointment(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pt_override_appointment_consequence(uuid, text, text) TO authenticated;