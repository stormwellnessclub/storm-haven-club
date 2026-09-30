CREATE OR REPLACE FUNCTION public.pt_reschedule_appointment(
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

  IF v_instructor IS DISTINCT FROM v_appt.instructor_id
     AND NOT public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk']::app_role[]) THEN
    RAISE EXCEPTION 'Only staff can reassign the trainer';
  END IF;

  v_conflict := public.pt_check_appointment_conflict(v_start, v_end, v_instructor, v_location, p_appointment_id, v_appt.format);
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