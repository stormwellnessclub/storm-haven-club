
CREATE OR REPLACE FUNCTION public.pt_complete_session(
  p_appointment_id uuid,
  p_note jsonb DEFAULT '{}'::jsonb,
  p_deduct boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt public.pt_appointments%ROWTYPE;
  v_pass public.pt_passes%ROWTYPE;
  v_uid uuid := auth.uid();
  v_note_id uuid;
  v_deducted boolean := false;
BEGIN
  IF NOT public.pt_is_staff_or_desk(v_uid) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_appt FROM public.pt_appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  -- Package deduction (idempotent)
  IF p_deduct AND COALESCE(v_appt.package_deducted, false) = false THEN
    IF v_appt.pass_id IS NOT NULL THEN
      SELECT * INTO v_pass FROM public.pt_passes WHERE id = v_appt.pass_id FOR UPDATE;
    ELSE
      SELECT * INTO v_pass FROM public.pt_passes
      WHERE user_id = v_appt.user_id
        AND status = 'active'
        AND sessions_remaining > 0
        AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)
      ORDER BY expires_at NULLS LAST, created_at
      LIMIT 1
      FOR UPDATE;
    END IF;

    IF v_pass.id IS NULL OR COALESCE(v_pass.sessions_remaining, 0) <= 0 THEN
      RAISE EXCEPTION 'PACKAGE_DEDUCTION_FAILED: no package session available for this client';
    END IF;

    UPDATE public.pt_passes
      SET sessions_remaining = sessions_remaining - 1,
          status = CASE WHEN sessions_remaining - 1 <= 0 THEN 'exhausted'::pt_pass_status ELSE status END,
          updated_at = now()
      WHERE id = v_pass.id;

    INSERT INTO public.pt_session_usage (pass_id, used_at, used_by_admin_id, notes)
    VALUES (v_pass.id, now(), v_uid, 'Session completed');

    v_deducted := true;
  END IF;

  -- Session note (one per appointment)
  SELECT id INTO v_note_id FROM public.pt_session_notes WHERE appointment_id = p_appointment_id LIMIT 1;

  IF v_note_id IS NULL THEN
    INSERT INTO public.pt_session_notes (
      appointment_id, user_id, instructor_id, session_date, subjective, objective, observations,
      modifications, pain_discomfort, rpe, homework, next_focus, private_note, exercise_log,
      is_draft, created_by, updated_by
    ) VALUES (
      p_appointment_id, v_appt.user_id, v_appt.instructor_id, (v_appt.starts_at AT TIME ZONE 'America/Detroit')::date,
      p_note->>'subjective', p_note->>'objective', p_note->>'observations',
      p_note->>'modifications', p_note->>'pain_discomfort',
      NULLIF(p_note->>'rpe','')::numeric, p_note->>'homework', p_note->>'next_focus',
      p_note->>'private_note', COALESCE(p_note->'exercise_log', '[]'::jsonb),
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
      exercise_log = COALESCE(p_note->'exercise_log', exercise_log),
      is_draft = false,
      updated_by = v_uid,
      updated_at = now()
    WHERE id = v_note_id;
  END IF;

  UPDATE public.pt_appointments SET
    status = 'completed'::pt_appointment_status,
    completed_at = COALESCE(completed_at, now()),
    package_deducted = CASE WHEN v_deducted THEN true ELSE package_deducted END,
    package_deducted_at = CASE WHEN v_deducted THEN now() ELSE package_deducted_at END,
    pass_id = COALESCE(pass_id, v_pass.id),
    updated_at = now()
  WHERE id = p_appointment_id;

  RETURN jsonb_build_object(
    'success', true,
    'note_id', v_note_id,
    'deducted', v_deducted,
    'pass_id', v_pass.id,
    'pass_name', v_pass.pack_name,
    'sessions_remaining', CASE WHEN v_deducted THEN v_pass.sessions_remaining - 1 ELSE v_pass.sessions_remaining END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pt_complete_session(uuid, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_complete_session(uuid, jsonb, boolean) TO authenticated;
