-- 1. Lead vs appointment-request classification
ALTER TABLE public.training_requests
  ADD COLUMN IF NOT EXISTS request_kind text NOT NULL DEFAULT 'inquiry',
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'public_pt_form',
  ADD COLUMN IF NOT EXISTS converted_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_by uuid;
UPDATE public.training_requests SET request_kind='inquiry', origin='public_pt_form' WHERE client_user_id IS NULL OR request_kind='inquiry';
ALTER TABLE public.training_requests
  ADD CONSTRAINT training_requests_kind_chk CHECK (request_kind IN ('inquiry','appointment_request')),
  ADD CONSTRAINT training_requests_origin_chk CHECK (origin IN ('public_pt_form','authenticated_client','staff_created','other'));
CREATE INDEX IF NOT EXISTS training_requests_kind_idx ON public.training_requests(request_kind, created_at);

-- Authenticated client requests are appointment requests
CREATE OR REPLACE FUNCTION public.pt_request_classify_client() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.client_user_id IS NOT NULL AND NEW.pt_session_type_id IS NOT NULL AND NEW.preferred_date IS NOT NULL
     AND NEW.client_user_id = auth.uid() THEN
    NEW.request_kind := 'appointment_request';
    NEW.origin := 'authenticated_client';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_pt_request_classify ON public.training_requests;
CREATE TRIGGER trg_pt_request_classify BEFORE INSERT ON public.training_requests
  FOR EACH ROW EXECUTE FUNCTION public.pt_request_classify_client();

-- Intentional conversion of an inquiry into an appointment request
CREATE OR REPLACE FUNCTION public.pt_request_convert_inquiry(p_request_id uuid, p_client_user_id uuid)
RETURNS training_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r training_requests;
BEGIN
  IF NOT pt_request_is_manager() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO r FROM training_requests WHERE id = p_request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Inquiry not found'; END IF;
  IF r.request_kind = 'appointment_request' THEN RETURN r; END IF;
  IF p_client_user_id IS NULL THEN RAISE EXCEPTION 'Choose the client account to link before converting'; END IF;
  UPDATE training_requests SET request_kind='appointment_request', client_user_id=p_client_user_id,
    request_status='requested', converted_at=now(), converted_by=auth.uid(), updated_at=now()
   WHERE id = r.id RETURNING * INTO r;
  RETURN r;
END $$;
GRANT EXECUTE ON FUNCTION public.pt_request_convert_inquiry(uuid, uuid) TO authenticated;

-- 2. Reservation state on appointments
ALTER TABLE public.pt_appointments
  ADD COLUMN IF NOT EXISTS reservation_state text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS reserved_at timestamptz,
  ADD COLUMN IF NOT EXISTS reservation_resolved_at timestamptz;
ALTER TABLE public.pt_appointments ADD CONSTRAINT pt_appointments_reservation_chk
  CHECK (reservation_state IN ('none','reserved','consumed','released'));
CREATE INDEX IF NOT EXISTS pt_appointments_reserved_idx ON public.pt_appointments(pass_id) WHERE reservation_state='reserved';

CREATE OR REPLACE FUNCTION public.pt_pass_reserved_count(p_pass_id uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT count(*)::int FROM pt_appointments WHERE pass_id = p_pass_id AND reservation_state='reserved' AND status='scheduled';
$$;
GRANT EXECUTE ON FUNCTION public.pt_pass_reserved_count(uuid) TO authenticated;

CREATE OR REPLACE VIEW public.pt_pass_balances WITH (security_invoker = true) AS
SELECT p.id AS pass_id, p.user_id,
  p.sessions_total AS sessions_purchased,
  GREATEST(p.sessions_total - p.sessions_remaining, 0) AS sessions_consumed,
  p.sessions_remaining AS entitlement_remaining,
  COALESCE(r.cnt, 0)::int AS sessions_reserved,
  GREATEST(p.sessions_remaining - COALESCE(r.cnt, 0), 0)::int AS available_to_book
FROM public.pt_passes p
LEFT JOIN (SELECT pass_id, count(*) cnt FROM public.pt_appointments
           WHERE reservation_state='reserved' AND status='scheduled' GROUP BY pass_id) r ON r.pass_id = p.id;
GRANT SELECT ON public.pt_pass_balances TO authenticated;
GRANT SELECT ON public.pt_pass_balances TO service_role;

-- Pass picker honours available-to-book
CREATE OR REPLACE FUNCTION public.pt_pick_pass_for_appointment(p_appt pt_appointments)
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(
    p_appt.pass_id,
    (SELECT p.id FROM public.pt_passes p
      WHERE p.user_id = p_appt.user_id AND p.status = 'active'
        AND p.sessions_remaining - public.pt_pass_reserved_count(p.id) > 0
        AND (p.expires_at IS NULL OR p.expires_at >= (now() AT TIME ZONE 'America/Detroit')::date)
      ORDER BY p.expires_at NULLS LAST, p.created_at LIMIT 1));
$$;

-- Internal: reserve / release / consume (audited in the existing usage ledger)
CREATE OR REPLACE FUNCTION public.pt_reservation_release(p_appointment_id uuid, p_reason text, p_actor uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a pt_appointments;
BEGIN
  SELECT * INTO a FROM pt_appointments WHERE id = p_appointment_id FOR UPDATE;
  IF a.reservation_state <> 'reserved' THEN RETURN false; END IF;
  PERFORM public.pt_apply_session_delta(a.pass_id, 0, 'session_reservation_released', p_reason, a.id,
    'appt_reserve_release:' || a.id::text, NULL, p_actor);
  UPDATE pt_appointments SET reservation_state='released', reservation_resolved_at=now(), updated_at=now() WHERE id = a.id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.pt_reservation_consume(p_appointment_id uuid, p_reason text, p_key text, p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a pt_appointments; v_res jsonb;
BEGIN
  SELECT * INTO a FROM pt_appointments WHERE id = p_appointment_id FOR UPDATE;
  IF a.reservation_state <> 'reserved' THEN RETURN NULL; END IF;
  v_res := public.pt_apply_session_delta(a.pass_id, -1, 'session_used', p_reason, a.id, p_key, NULL, p_actor);
  UPDATE pt_appointments SET reservation_state='consumed', reservation_resolved_at=now(),
    package_deducted=true, package_deducted_at=COALESCE(package_deducted_at, now()),
    usage_id=COALESCE(usage_id, NULLIF(v_res->>'usage_id','')::uuid), updated_at=now()
   WHERE id = a.id;
  RETURN v_res;
END $$;
REVOKE ALL ON FUNCTION public.pt_reservation_release(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pt_reservation_consume(uuid,text,text,uuid) FROM PUBLIC, anon, authenticated;

-- 3. Booking reserves instead of consuming
CREATE OR REPLACE FUNCTION public.book_pt_appointment(p_user_id uuid, p_format pt_format, p_starts_at timestamp with time zone, p_duration_minutes integer DEFAULT 60, p_instructor_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text, p_pass_id uuid DEFAULT NULL::uuid, p_unpaid boolean DEFAULT false, p_rate_cents integer DEFAULT 0, p_location_id uuid DEFAULT NULL::uuid, p_force boolean DEFAULT false)
 RETURNS pt_appointments LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_pass public.pt_passes;
  v_appt public.pt_appointments;
  v_admin uuid := auth.uid();
  v_is_staff boolean := has_any_role(auth.uid(), ARRAY['admin'::app_role,'super_admin'::app_role,'manager'::app_role,'front_desk'::app_role]);
  v_ends_at timestamptz := p_starts_at + (p_duration_minutes || ' minutes')::interval;
  v_conflict jsonb;
BEGIN
  IF NOT v_is_staff AND auth.uid() <> p_user_id THEN RAISE EXCEPTION 'Not authorized to book for this user'; END IF;
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

-- 4. Completion converts reservation to consumption
CREATE OR REPLACE FUNCTION public.pt_complete_session(p_appointment_id uuid, p_note jsonb DEFAULT '{}'::jsonb, p_deduct boolean DEFAULT true)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_appt public.pt_appointments%ROWTYPE;
  v_pass_id uuid;
  v_uid uuid := auth.uid();
  v_note_id uuid;
  v_res jsonb;
  v_deducted boolean := false;
BEGIN
  IF NOT public.pt_is_staff_or_desk(v_uid) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_appt FROM public.pt_appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;

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
    package_deducted = CASE WHEN v_res IS NOT NULL THEN true ELSE package_deducted END,
    package_deducted_at = CASE WHEN v_res IS NOT NULL THEN COALESCE(package_deducted_at, now()) ELSE package_deducted_at END,
    pass_id = COALESCE(pass_id, v_pass_id),
    usage_id = COALESCE(usage_id, NULLIF(v_res->>'usage_id','')::uuid), updated_at = now()
  WHERE id = p_appointment_id;

  RETURN jsonb_build_object('success', true, 'note_id', v_note_id, 'deducted', v_deducted, 'pass_id', v_pass_id,
    'pass_name', v_res->>'pass_name', 'sessions_remaining', NULLIF(v_res->>'sessions_after','')::integer);
END $function$;

-- 5. Cancellation: release or convert reservation
CREATE OR REPLACE FUNCTION public.cancel_pt_appointment(p_appointment_id uuid, p_reason text DEFAULT NULL::text, p_outcome text DEFAULT NULL::text, p_override_reason text DEFAULT NULL::text)
 RETURNS pt_appointments LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_appt public.pt_appointments%ROWTYPE;
  v_is_staff boolean := public.pt_is_staff_or_desk(auth.uid());
  v_policy text; v_final text; v_consumes boolean;
  v_usage public.pt_session_usage%ROWTYPE;
  v_pass_id uuid; v_res jsonb; v_credit_outcome text; v_overridden boolean := false;
BEGIN
  SELECT * INTO v_appt FROM public.pt_appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  IF NOT v_is_staff AND v_appt.user_id <> auth.uid() THEN RAISE EXCEPTION 'Not authorized to cancel this appointment'; END IF;
  IF v_appt.status NOT IN ('scheduled') THEN RAISE EXCEPTION 'Appointment already %', v_appt.status; END IF;

  IF v_is_staff THEN v_policy := 'staff_cancel';
  ELSIF now() <= v_appt.starts_at - interval '24 hours' THEN v_policy := 'timely_client_cancel';
  ELSE v_policy := 'late_client_cancel'; END IF;

  v_final := COALESCE(NULLIF(btrim(COALESCE(p_outcome, '')), ''), v_policy);
  IF v_final <> v_policy AND NOT (v_final = 'no_show' AND v_is_staff) THEN
    IF NOT v_is_staff THEN RAISE EXCEPTION 'Not authorized to override the cancellation outcome'; END IF;
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
         no_show_consumed = (v_final = 'no_show' AND v_credit_outcome = 'consumed'),
         payment_status = CASE WHEN NOT v_consumes AND v_appt.pass_id IS NULL AND v_appt.payment_status = 'unpaid' THEN 'cancelled' ELSE v_appt.payment_status END,
         amount_due_cents = CASE WHEN NOT v_consumes AND v_appt.pass_id IS NULL AND v_appt.payment_status = 'unpaid' THEN 0 ELSE v_appt.amount_due_cents END,
         updated_at = now()
   WHERE id = p_appointment_id
  RETURNING * INTO v_appt;
  RETURN v_appt;
END $function$;

-- 6. Manual deduction toggle respects reservations
CREATE OR REPLACE FUNCTION public.pt_set_package_deduction(p_appointment_id uuid, p_deduct boolean)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_appt public.pt_appointments%ROWTYPE; v_pass_id uuid; v_usage public.pt_session_usage%ROWTYPE; v_res jsonb; v_uid uuid := auth.uid();
BEGIN
  IF NOT public.pt_is_staff_or_desk(v_uid) THEN RAISE EXCEPTION 'Not authorized'; END IF;
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

-- 7. Only appointment requests are confirmable; package detection uses available-to-book
CREATE OR REPLACE FUNCTION public.pt_request_confirm(p_request_id uuid, p_use_alternate boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE r training_requests; st pt_session_types; v_date date; v_time time; v_trainer uuid; v_start timestamptz; v_end timestamptz;
  c record; v_appt pt_appointments; v_has_pass boolean;
BEGIN
  SELECT * INTO r FROM training_requests WHERE id = p_request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT pt_request_can_act(r) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF r.request_status = 'confirmed' OR r.appointment_id IS NOT NULL THEN
    RETURN jsonb_build_object('appointment_id', r.appointment_id, 'already_confirmed', true);
  END IF;
  IF r.request_kind <> 'appointment_request' THEN
    RAISE EXCEPTION 'This is a website inquiry. Convert it to an appointment request before confirming';
  END IF;
  IF r.request_status IN ('declined','cancelled') THEN RAISE EXCEPTION 'This request is already %', r.request_status; END IF;
  IF r.client_user_id IS NULL THEN RAISE EXCEPTION 'Link this request to a client account before confirming'; END IF;
  SELECT * INTO st FROM pt_session_types WHERE id = r.pt_session_type_id;
  IF st.id IS NULL THEN RAISE EXCEPTION 'Choose a session type before confirming'; END IF;
  IF p_use_alternate THEN
    IF r.request_status <> 'alternate_offered' THEN RAISE EXCEPTION 'No alternate has been offered'; END IF;
    v_date := r.alt_date; v_time := r.alt_time; v_trainer := coalesce(r.alt_trainer_id, r.requested_trainer_id);
  ELSE
    v_date := r.preferred_date; v_time := r.preferred_time; v_trainer := r.requested_trainer_id;
  END IF;
  IF v_date IS NULL OR v_time IS NULL THEN RAISE EXCEPTION 'Set a date and time before confirming'; END IF;
  IF v_trainer IS NULL THEN RAISE EXCEPTION 'Assign a trainer before confirming'; END IF;
  v_start := (v_date + v_time) AT TIME ZONE 'America/Detroit';
  v_end := v_start + make_interval(mins => st.duration_minutes);

  SELECT a.starts_at, a.ends_at INTO c FROM pt_appointments a
   WHERE a.instructor_id = v_trainer AND a.status NOT IN ('cancelled','late_cancel','no_show')
     AND a.starts_at < v_end AND a.ends_at > v_start ORDER BY a.starts_at LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'TRAINER_CONFLICT: Trainer already has a session % – % on %',
    to_char(c.starts_at AT TIME ZONE 'America/Detroit','FMHH12:MI AM'), to_char(c.ends_at AT TIME ZONE 'America/Detroit','FMHH12:MI AM'),
    to_char(c.starts_at AT TIME ZONE 'America/Detroit','Mon FMDD'); END IF;
  SELECT a.starts_at, a.ends_at INTO c FROM pt_appointments a
   WHERE a.user_id = r.client_user_id AND a.status NOT IN ('cancelled','late_cancel','no_show')
     AND a.starts_at < v_end AND a.ends_at > v_start ORDER BY a.starts_at LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'CLIENT_CONFLICT: Client already has a training session % – % on %',
    to_char(c.starts_at AT TIME ZONE 'America/Detroit','FMHH12:MI AM'), to_char(c.ends_at AT TIME ZONE 'America/Detroit','FMHH12:MI AM'),
    to_char(c.starts_at AT TIME ZONE 'America/Detroit','Mon FMDD'); END IF;

  v_has_pass := EXISTS (SELECT 1 FROM pt_passes WHERE user_id = r.client_user_id AND format = st.format AND status='active'
    AND sessions_remaining - pt_pass_reserved_count(id) > 0 AND expires_at >= (now() AT TIME ZONE 'America/Detroit')::date);
  v_appt := public.book_pt_appointment(r.client_user_id, st.format, v_start, st.duration_minutes, v_trainer,
    coalesce(r.client_note, r.goals), NULL, NOT v_has_pass, coalesce(st.default_price_cents,0), st.default_location_id, true);
  UPDATE pt_appointments SET session_type_id = st.id WHERE id = v_appt.id;
  UPDATE training_requests SET request_status='confirmed', appointment_id=v_appt.id, requested_trainer_id=v_trainer,
    resolved_at=now(), resolved_by=auth.uid(), updated_at=now() WHERE id = r.id;
  RETURN jsonb_build_object('appointment_id', v_appt.id, 'already_confirmed', false, 'package_reserved', v_has_pass);
END $function$;

-- 8. Deterministic conversion of existing future bookings: consumed -> reserved
DO $$
DECLARE a record; v_res jsonb;
BEGIN
  FOR a IN
    SELECT ap.id, ap.pass_id, u.id AS usage_id FROM public.pt_appointments ap
    JOIN public.pt_session_usage u ON u.id = ap.usage_id
    WHERE ap.status = 'scheduled' AND ap.starts_at > now() AND ap.package_deducted AND ap.pass_id IS NOT NULL
      AND u.event_type = 'session_used' AND u.reason = 'Booked appointment' AND u.reversed_at IS NULL AND u.quantity = -1
  LOOP
    v_res := public.pt_apply_session_delta(a.pass_id, 1, 'session_reservation_converted',
      'Booking credit converted from used to reserved (2D.1.1)', a.id, 'appt_reserve_convert:' || a.id::text, a.usage_id, NULL);
    UPDATE public.pt_appointments SET package_deducted = false, package_deducted_at = NULL, usage_id = NULL,
      reservation_state = 'reserved', reserved_at = now() WHERE id = a.id;
  END LOOP;
END $$;
