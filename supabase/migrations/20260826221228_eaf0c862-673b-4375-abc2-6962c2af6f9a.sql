-- ============================================================
-- PHASE 2A (2/2): authoritative PT balance + sale functions
-- ============================================================

-- 0. Authorization helpers -------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_request_role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::json ->> 'role'),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.pt_is_financial_staff(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(_uid, ARRAY['admin','super_admin','manager','front_desk']::app_role[])
      OR public.pt_request_role() = 'service_role';
$$;

-- 1. THE single authoritative session-credit mutation ----------------------
CREATE OR REPLACE FUNCTION public.pt_apply_session_delta(
  p_pass_id uuid,
  p_delta integer,
  p_event_type text,
  p_reason text,
  p_appointment_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_reverses_usage_id uuid DEFAULT NULL,
  p_actor uuid DEFAULT NULL,
  p_used_at timestamptz DEFAULT NULL,
  p_grow_total boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pass public.pt_passes%ROWTYPE;
  v_existing public.pt_session_usage%ROWTYPE;
  v_after integer;
  v_total integer;
  v_status text;
  v_usage_id uuid;
  v_actor uuid := COALESCE(p_actor, auth.uid());
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.pt_session_usage
      WHERE idempotency_key = p_idempotency_key LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true, 'duplicate', true, 'usage_id', v_existing.id,
        'sessions_before', v_existing.sessions_before,
        'sessions_after', v_existing.sessions_after,
        'pass_id', v_existing.pass_id
      );
    END IF;
  END IF;

  SELECT * INTO v_pass FROM public.pt_passes WHERE id = p_pass_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Package not found'; END IF;

  IF p_delta < 0 AND (v_pass.sessions_remaining + p_delta) < 0 THEN
    RAISE EXCEPTION 'NO_SESSIONS: package does not have % session(s) available', abs(p_delta);
  END IF;

  v_after := GREATEST(0, v_pass.sessions_remaining + p_delta);
  v_total := CASE
               WHEN p_grow_total THEN GREATEST(v_pass.sessions_total, v_after)
               ELSE v_pass.sessions_total
             END;

  v_status := v_pass.status::text;
  IF v_status = 'active' AND v_after = 0 THEN
    v_status := 'exhausted';
  ELSIF v_status = 'exhausted' AND v_after > 0 THEN
    v_status := 'active';
  END IF;

  PERFORM set_config('pt.ledger', 'on', true);

  UPDATE public.pt_passes
     SET sessions_remaining = v_after,
         sessions_total = v_total,
         status = v_status::pt_pass_status,
         updated_at = now()
   WHERE id = p_pass_id;

  INSERT INTO public.pt_session_usage (
    pass_id, appointment_id, event_type, quantity, reason, notes,
    used_at, used_by_admin_id, created_by, sessions_before, sessions_after,
    reverses_usage_id, idempotency_key
  ) VALUES (
    p_pass_id, p_appointment_id, p_event_type, p_delta, p_reason, p_reason,
    COALESCE(p_used_at, now()), v_actor, v_actor,
    v_pass.sessions_remaining, v_after, p_reverses_usage_id, p_idempotency_key
  ) RETURNING id INTO v_usage_id;

  IF p_reverses_usage_id IS NOT NULL THEN
    UPDATE public.pt_session_usage
       SET reversed_at = now(),
           reversed_by = v_actor,
           reversal_reason = p_reason,
           reversed_by_usage_id = v_usage_id
     WHERE id = p_reverses_usage_id
       AND reversed_at IS NULL;
  END IF;

  PERFORM set_config('pt.ledger', '', true);

  RETURN jsonb_build_object(
    'success', true, 'duplicate', false, 'usage_id', v_usage_id,
    'pass_id', p_pass_id, 'pass_name', v_pass.pack_name,
    'sessions_before', v_pass.sessions_remaining, 'sessions_after', v_after
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pt_apply_session_delta(uuid,integer,text,text,uuid,text,uuid,uuid,timestamptz,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pt_apply_session_delta(uuid,integer,text,text,uuid,text,uuid,uuid,timestamptz,boolean) TO service_role;

-- helper: pick the package a deduction should come from
CREATE OR REPLACE FUNCTION public.pt_pick_pass_for_appointment(p_appt public.pt_appointments)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    p_appt.pass_id,
    (SELECT p.id FROM public.pt_passes p
      WHERE p.user_id = p_appt.user_id
        AND p.status = 'active'
        AND p.sessions_remaining > 0
        AND (p.expires_at IS NULL OR p.expires_at >= (now() AT TIME ZONE 'America/Detroit')::date)
      ORDER BY p.expires_at NULLS LAST, p.created_at
      LIMIT 1)
  );
$$;

REVOKE ALL ON FUNCTION public.pt_pick_pass_for_appointment(public.pt_appointments) FROM PUBLIC, anon;

-- 2. COMPLETE SESSION (idempotent) ----------------------------------------
CREATE OR REPLACE FUNCTION public.pt_complete_session(p_appointment_id uuid, p_note jsonb DEFAULT '{}'::jsonb, p_deduct boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt public.pt_appointments%ROWTYPE;
  v_pass_id uuid;
  v_uid uuid := auth.uid();
  v_note_id uuid;
  v_res jsonb;
  v_deducted boolean := false;
BEGIN
  IF NOT public.pt_is_staff_or_desk(v_uid) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_appt FROM public.pt_appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;

  IF p_deduct AND COALESCE(v_appt.package_deducted, false) = false THEN
    v_pass_id := public.pt_pick_pass_for_appointment(v_appt);
    IF v_pass_id IS NULL THEN
      RAISE EXCEPTION 'PACKAGE_DEDUCTION_FAILED: no package session available for this client';
    END IF;

    v_res := public.pt_apply_session_delta(
      p_pass_id => v_pass_id,
      p_delta => -1,
      p_event_type => 'session_used',
      p_reason => 'Session completed',
      p_appointment_id => p_appointment_id,
      p_idempotency_key => 'appt_complete:' || p_appointment_id::text,
      p_actor => v_uid
    );
    v_deducted := NOT COALESCE((v_res->>'duplicate')::boolean, false);
  END IF;

  SELECT id INTO v_note_id FROM public.pt_session_notes WHERE appointment_id = p_appointment_id LIMIT 1;

  IF v_note_id IS NULL THEN
    INSERT INTO public.pt_session_notes (
      appointment_id, user_id, instructor_id, session_date, subjective, objective, observations,
      modifications, pain_discomfort, rpe, homework, next_focus, private_note, client_recap, exercise_log,
      is_draft, created_by, updated_by
    ) VALUES (
      p_appointment_id, v_appt.user_id, v_appt.instructor_id, (v_appt.starts_at AT TIME ZONE 'America/Detroit')::date,
      p_note->>'subjective', p_note->>'objective', p_note->>'observations',
      p_note->>'modifications', p_note->>'pain_discomfort',
      NULLIF(p_note->>'rpe','')::numeric, p_note->>'homework', p_note->>'next_focus',
      p_note->>'private_note', p_note->>'client_recap', COALESCE(p_note->'exercise_log', '{}'::jsonb),
      false, v_uid, v_uid
    ) RETURNING id INTO v_note_id;
  ELSE
    UPDATE public.pt_session_notes SET
      subjective = COALESCE(p_note->>'subjective', subjective),
      objective = COALESCE(p_note->>'objective', objective),
      observations = COALESCE(p_note->>'observations', observations),
      modifications = COALESCE(p_note->>'modifications', modifications),
      pain_discomfort = COALESCE(p_note->>'pain_discomfort', pain_discomfort),
      rpe = COALESCE(NULLIF(p_note->>'rpe','')::numeric, rpe),
      homework = COALESCE(p_note->>'homework', homework),
      next_focus = COALESCE(p_note->>'next_focus', next_focus),
      private_note = COALESCE(p_note->>'private_note', private_note),
      client_recap = COALESCE(p_note->>'client_recap', client_recap),
      exercise_log = COALESCE(p_note->'exercise_log', exercise_log),
      is_draft = false,
      updated_by = v_uid,
      updated_at = now()
    WHERE id = v_note_id;
  END IF;

  UPDATE public.pt_appointments SET
    status = 'completed'::pt_appointment_status,
    completed_at = COALESCE(completed_at, now()),
    package_deducted = CASE WHEN v_res IS NOT NULL THEN true ELSE package_deducted END,
    package_deducted_at = CASE WHEN v_res IS NOT NULL THEN COALESCE(package_deducted_at, now()) ELSE package_deducted_at END,
    pass_id = COALESCE(pass_id, v_pass_id),
    usage_id = COALESCE(usage_id, NULLIF(v_res->>'usage_id','')::uuid),
    updated_at = now()
  WHERE id = p_appointment_id;

  RETURN jsonb_build_object(
    'success', true,
    'note_id', v_note_id,
    'deducted', v_deducted,
    'pass_id', v_pass_id,
    'pass_name', v_res->>'pass_name',
    'sessions_remaining', NULLIF(v_res->>'sessions_after','')::integer
  );
END;
$$;

-- 3. MANUAL DEDUCT / RESTORE ON AN APPOINTMENT -----------------------------
CREATE OR REPLACE FUNCTION public.pt_set_package_deduction(p_appointment_id uuid, p_deduct boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt public.pt_appointments%ROWTYPE;
  v_pass_id uuid;
  v_usage public.pt_session_usage%ROWTYPE;
  v_res jsonb;
  v_uid uuid := auth.uid();
BEGIN
  IF NOT public.pt_is_staff_or_desk(v_uid) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_appt FROM public.pt_appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;

  IF p_deduct THEN
    IF COALESCE(v_appt.package_deducted, false) THEN
      RETURN jsonb_build_object('success', true, 'changed', false);
    END IF;

    v_pass_id := public.pt_pick_pass_for_appointment(v_appt);
    IF v_pass_id IS NULL THEN
      RAISE EXCEPTION 'NO_SESSIONS: no package session available for this client';
    END IF;

    v_res := public.pt_apply_session_delta(
      p_pass_id => v_pass_id,
      p_delta => -1,
      p_event_type => 'session_used',
      p_reason => 'Manual credit deduction',
      p_appointment_id => p_appointment_id,
      p_idempotency_key => 'appt_manual_deduct:' || p_appointment_id::text,
      p_actor => v_uid,
      p_used_at => COALESCE(v_appt.starts_at, now())
    );

    UPDATE public.pt_appointments
       SET package_deducted = true,
           package_deducted_at = now(),
           pass_id = COALESCE(pass_id, v_pass_id),
           usage_id = NULLIF(v_res->>'usage_id','')::uuid,
           updated_at = now()
     WHERE id = p_appointment_id;
  ELSE
    IF NOT COALESCE(v_appt.package_deducted, false) THEN
      RETURN jsonb_build_object('success', true, 'changed', false);
    END IF;
    IF v_appt.pass_id IS NULL THEN
      RAISE EXCEPTION 'No package linked to this session';
    END IF;

    SELECT * INTO v_usage FROM public.pt_session_usage
      WHERE appointment_id = p_appointment_id AND quantity < 0 AND reversed_at IS NULL
      ORDER BY created_at DESC LIMIT 1;

    v_res := public.pt_apply_session_delta(
      p_pass_id => v_appt.pass_id,
      p_delta => 1,
      p_event_type => 'session_restored',
      p_reason => 'Manual credit restored by staff',
      p_appointment_id => p_appointment_id,
      p_idempotency_key => 'appt_manual_restore:' || p_appointment_id::text || ':' || COALESCE(v_usage.id::text, 'none'),
      p_reverses_usage_id => v_usage.id,
      p_actor => v_uid
    );

    UPDATE public.pt_appointments
       SET package_deducted = false, package_deducted_at = NULL, usage_id = NULL, updated_at = now()
     WHERE id = p_appointment_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'changed', true,
    'sessions_remaining', NULLIF(v_res->>'sessions_after','')::integer
  );
END;
$$;

-- 4. CANCELLATION OUTCOMES -------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_cancel_outcome_consumes(p_outcome text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_outcome IN ('late_client_cancel', 'no_show');
$$;

DROP FUNCTION IF EXISTS public.cancel_pt_appointment(uuid, text);

CREATE OR REPLACE FUNCTION public.cancel_pt_appointment(
  p_appointment_id uuid,
  p_reason text DEFAULT NULL,
  p_outcome text DEFAULT NULL,
  p_override_reason text DEFAULT NULL
)
RETURNS public.pt_appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF v_final <> v_policy THEN
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
$$;

REVOKE ALL ON FUNCTION public.cancel_pt_appointment(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_pt_appointment(uuid,text,text,text) TO authenticated, service_role;

-- 5. NO-SHOW ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_mark_no_show(
  p_appointment_id uuid,
  p_consume boolean DEFAULT true,
  p_reason text DEFAULT NULL,
  p_override_reason text DEFAULT NULL
)
RETURNS public.pt_appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt public.pt_appointments%ROWTYPE;
BEGIN
  IF NOT public.pt_is_staff_or_desk(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_consume THEN
    v_appt := public.cancel_pt_appointment(p_appointment_id, COALESCE(p_reason, 'No show'), 'no_show', NULL);
  ELSE
    v_appt := public.cancel_pt_appointment(
      p_appointment_id,
      COALESCE(p_reason, 'No show — session not consumed'),
      'admin_override_credit',
      COALESCE(p_override_reason, 'No-show excused by staff')
    );
    UPDATE public.pt_appointments
       SET status = 'no_show'::pt_appointment_status,
           no_show_at = now(),
           cancel_outcome_reason = 'no_show',
           updated_at = now()
     WHERE id = p_appointment_id
    RETURNING * INTO v_appt;
  END IF;

  IF p_consume THEN
    UPDATE public.pt_appointments
       SET no_show_at = COALESCE(no_show_at, now())
     WHERE id = p_appointment_id
    RETURNING * INTO v_appt;
  END IF;

  RETURN v_appt;
END;
$$;

REVOKE ALL ON FUNCTION public.pt_mark_no_show(uuid,boolean,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_mark_no_show(uuid,boolean,text,text) TO authenticated, service_role;

-- 6. MANUAL ADJUSTMENT / TRANSFER / CONSUME --------------------------------
CREATE OR REPLACE FUNCTION public.pt_adjust_pass_balance(
  p_pass_id uuid, p_delta integer, p_reason text,
  p_adjustment_type text DEFAULT 'manual', p_new_expires_at date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pass public.pt_passes%ROWTYPE;
  v_res jsonb;
  v_after integer;
  v_exp_before date;
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF COALESCE(btrim(COALESCE(p_reason,'')), '') = '' THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;

  SELECT * INTO v_pass FROM public.pt_passes WHERE id = p_pass_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Package not found'; END IF;
  v_exp_before := v_pass.expires_at;

  IF COALESCE(p_delta, 0) <> 0 THEN
    v_res := public.pt_apply_session_delta(
      p_pass_id => p_pass_id,
      p_delta => p_delta,
      p_event_type => CASE WHEN p_delta > 0 THEN 'manual_credit' ELSE 'manual_debit' END,
      p_reason => btrim(p_reason),
      p_actor => auth.uid(),
      p_grow_total => true
    );
    v_after := (v_res->>'sessions_after')::integer;
  ELSE
    v_after := v_pass.sessions_remaining;
  END IF;

  IF p_new_expires_at IS NOT NULL THEN
    UPDATE public.pt_passes SET expires_at = p_new_expires_at, updated_at = now() WHERE id = p_pass_id;
  END IF;

  INSERT INTO public.pt_pass_adjustments
    (pass_id, user_id, delta_sessions, sessions_before, sessions_after, adjustment_type,
     reason, expires_at_before, expires_at_after, created_by)
  VALUES
    (p_pass_id, v_pass.user_id, COALESCE(p_delta,0), v_pass.sessions_remaining, v_after,
     COALESCE(p_adjustment_type,'manual'), btrim(p_reason), v_exp_before,
     COALESCE(p_new_expires_at, v_exp_before), auth.uid());

  RETURN jsonb_build_object('success', true, 'sessions_before', v_pass.sessions_remaining, 'sessions_after', v_after);
END;
$$;

CREATE OR REPLACE FUNCTION public.pt_transfer_pass_sessions(
  p_from_pass_id uuid, p_to_pass_id uuid, p_sessions integer, p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from public.pt_passes%ROWTYPE;
  v_to public.pt_passes%ROWTYPE;
  v_out jsonb;
  v_in jsonb;
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF COALESCE(p_sessions,0) <= 0 THEN RAISE EXCEPTION 'Sessions must be positive'; END IF;
  IF COALESCE(btrim(COALESCE(p_reason,'')), '') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF p_from_pass_id = p_to_pass_id THEN RAISE EXCEPTION 'Choose two different packages'; END IF;

  SELECT * INTO v_from FROM public.pt_passes WHERE id = p_from_pass_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source package not found'; END IF;
  SELECT * INTO v_to FROM public.pt_passes WHERE id = p_to_pass_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Destination package not found'; END IF;
  IF v_from.sessions_remaining < p_sessions THEN RAISE EXCEPTION 'Not enough sessions to transfer'; END IF;

  v_out := public.pt_apply_session_delta(
    p_pass_id => p_from_pass_id, p_delta => -p_sessions,
    p_event_type => 'transfer_out', p_reason => btrim(p_reason), p_actor => auth.uid());

  v_in := public.pt_apply_session_delta(
    p_pass_id => p_to_pass_id, p_delta => p_sessions,
    p_event_type => 'transfer_in', p_reason => btrim(p_reason), p_actor => auth.uid(),
    p_grow_total => true);

  INSERT INTO public.pt_pass_adjustments
    (pass_id, user_id, delta_sessions, sessions_before, sessions_after, adjustment_type, reason,
     expires_at_before, expires_at_after, created_by, transfer_pass_id)
  VALUES
    (p_from_pass_id, v_from.user_id, -p_sessions, (v_out->>'sessions_before')::int, (v_out->>'sessions_after')::int,
     'transfer_out', btrim(p_reason), v_from.expires_at, v_from.expires_at, auth.uid(), p_to_pass_id),
    (p_to_pass_id, v_to.user_id, p_sessions, (v_in->>'sessions_before')::int, (v_in->>'sessions_after')::int,
     'transfer_in', btrim(p_reason), v_to.expires_at, v_to.expires_at, auth.uid(), p_from_pass_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Retire the unaccountable deduction path
DROP FUNCTION IF EXISTS public.use_pt_session(uuid, text);

CREATE OR REPLACE FUNCTION public.pt_manual_consume_session(
  p_pass_id uuid, p_quantity integer DEFAULT 1, p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pass public.pt_passes%ROWTYPE;
  v_res jsonb;
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF COALESCE(p_quantity, 0) <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  IF COALESCE(btrim(COALESCE(p_reason,'')), '') = '' THEN
    RAISE EXCEPTION 'A reason is required to consume a session manually';
  END IF;

  SELECT * INTO v_pass FROM public.pt_passes WHERE id = p_pass_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Package not found'; END IF;
  IF v_pass.status <> 'active' THEN RAISE EXCEPTION 'Package is not active'; END IF;
  IF v_pass.expires_at < (now() AT TIME ZONE 'America/Detroit')::date THEN
    RAISE EXCEPTION 'Package expired';
  END IF;

  v_res := public.pt_apply_session_delta(
    p_pass_id => p_pass_id, p_delta => -p_quantity,
    p_event_type => 'manual_consume', p_reason => btrim(p_reason), p_actor => auth.uid());

  INSERT INTO public.pt_pass_adjustments
    (pass_id, user_id, delta_sessions, sessions_before, sessions_after, adjustment_type, reason,
     expires_at_before, expires_at_after, created_by)
  VALUES
    (p_pass_id, v_pass.user_id, -p_quantity, (v_res->>'sessions_before')::int, (v_res->>'sessions_after')::int,
     'manual_consume', btrim(p_reason), v_pass.expires_at, v_pass.expires_at, auth.uid());

  RETURN jsonb_build_object('success', true, 'sessions_remaining', (v_res->>'sessions_after')::int);
END;
$$;

REVOKE ALL ON FUNCTION public.pt_manual_consume_session(uuid,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_manual_consume_session(uuid,integer,text) TO authenticated, service_role;

-- 7. RECOVERABLE PACKAGE SALE ---------------------------------------------
CREATE OR REPLACE FUNCTION public.pt_open_sale_intent(
  p_idempotency_key text,
  p_user_id uuid,
  p_pack_name text,
  p_format public.pt_format,
  p_sessions_per_pack integer,
  p_quantity integer,
  p_unit_price_cents integer,
  p_activated_at date,
  p_expires_at date,
  p_payment_method text,
  p_pack_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.pt_sale_intents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.pt_sale_intents%ROWTYPE;
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF COALESCE(btrim(COALESCE(p_idempotency_key,'')), '') = '' THEN
    RAISE EXCEPTION 'A sale reference is required';
  END IF;
  IF COALESCE(p_quantity, 0) <= 0 OR COALESCE(p_sessions_per_pack, 0) <= 0 THEN
    RAISE EXCEPTION 'Quantity and sessions must be positive';
  END IF;

  SELECT * INTO v_row FROM public.pt_sale_intents WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN v_row; END IF;

  INSERT INTO public.pt_sale_intents (
    idempotency_key, user_id, pack_id, pack_name, format, sessions_per_pack, quantity,
    unit_price_cents, activated_at, expires_at, payment_method, notes, status, created_by
  ) VALUES (
    p_idempotency_key, p_user_id, p_pack_id, p_pack_name, p_format, p_sessions_per_pack, p_quantity,
    COALESCE(p_unit_price_cents, 0), p_activated_at, p_expires_at, COALESCE(p_payment_method,'offline'),
    p_notes, 'pending', auth.uid()
  ) RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.pt_record_sale_payment(
  p_idempotency_key text, p_stripe_payment_intent_id text, p_amount_cents integer
)
RETURNS public.pt_sale_intents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.pt_sale_intents%ROWTYPE;
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.pt_sale_intents
     SET stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
         amount_charged_cents = COALESCE(p_amount_cents, amount_charged_cents),
         status = CASE WHEN status = 'finalized' THEN 'finalized' ELSE 'paid' END,
         paid_at = COALESCE(paid_at, now())
   WHERE idempotency_key = p_idempotency_key
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.pt_fail_sale_intent(p_idempotency_key text, p_error text)
RETURNS public.pt_sale_intents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.pt_sale_intents%ROWTYPE;
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.pt_sale_intents
     SET finalize_error = p_error
   WHERE idempotency_key = p_idempotency_key AND status <> 'finalized'
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.pt_finalize_package_sale(
  p_idempotency_key text,
  p_actor uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale public.pt_sale_intents%ROWTYPE;
  v_pass_id uuid;
  v_ids uuid[] := '{}';
  v_actor uuid := COALESCE(auth.uid(), p_actor);
  i integer;
BEGIN
  IF NOT public.pt_is_financial_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_sale FROM public.pt_sale_intents
    WHERE idempotency_key = p_idempotency_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;

  IF v_sale.status = 'finalized' THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'pass_ids', v_sale.pass_ids);
  END IF;

  PERFORM set_config('pt.ledger', 'on', true);

  FOR i IN 1..v_sale.quantity LOOP
    INSERT INTO public.pt_passes (
      user_id, pack_id, format, pack_name, sessions_total, sessions_remaining,
      price_cents_charged, activated_at, expires_at, status, payment_method,
      stripe_payment_intent_id, sold_by_admin_id, notes, purchased_at
    ) VALUES (
      v_sale.user_id, v_sale.pack_id, v_sale.format, v_sale.pack_name,
      v_sale.sessions_per_pack, v_sale.sessions_per_pack, v_sale.unit_price_cents,
      v_sale.activated_at, v_sale.expires_at, 'active', v_sale.payment_method,
      v_sale.stripe_payment_intent_id, COALESCE(v_sale.created_by, v_actor), v_sale.notes, now()
    ) RETURNING id INTO v_pass_id;

    v_ids := v_ids || v_pass_id;

    INSERT INTO public.pt_session_usage (
      pass_id, event_type, quantity, reason, notes, used_at, used_by_admin_id, created_by,
      sessions_before, sessions_after, idempotency_key
    ) VALUES (
      v_pass_id, 'package_granted', v_sale.sessions_per_pack,
      'Package sold — ' || v_sale.pack_name, 'Package sold — ' || v_sale.pack_name,
      now(), COALESCE(v_sale.created_by, v_actor), COALESCE(v_sale.created_by, v_actor),
      0, v_sale.sessions_per_pack, 'sale_grant:' || p_idempotency_key || ':' || i::text
    );
  END LOOP;

  PERFORM set_config('pt.ledger', '', true);

  UPDATE public.pt_sale_intents
     SET status = 'finalized', pass_ids = v_ids, finalized_at = now(), finalize_error = NULL
   WHERE id = v_sale.id;

  RETURN jsonb_build_object('success', true, 'duplicate', false, 'pass_ids', v_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.pt_open_sale_intent(text,uuid,text,public.pt_format,integer,integer,integer,date,date,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_open_sale_intent(text,uuid,text,public.pt_format,integer,integer,integer,date,date,text,uuid,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.pt_record_sale_payment(text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_record_sale_payment(text,text,integer) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.pt_fail_sale_intent(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_fail_sale_intent(text,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.pt_finalize_package_sale(text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_finalize_package_sale(text,uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.pt_is_financial_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_is_financial_staff(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.pt_request_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_request_role() TO authenticated, service_role;