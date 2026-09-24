CREATE TABLE IF NOT EXISTS public.pt_appointments_snapshot_2d1 AS
  SELECT id, status::text AS status, starts_at, ends_at, instructor_id, user_id, updated_at, now() AS snapshot_at FROM public.pt_appointments;
GRANT SELECT ON public.pt_appointments_snapshot_2d1 TO authenticated;
GRANT ALL ON public.pt_appointments_snapshot_2d1 TO service_role;
ALTER TABLE public.pt_appointments_snapshot_2d1 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read snapshot" ON public.pt_appointments_snapshot_2d1 FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

ALTER TABLE public.training_requests
  ADD COLUMN IF NOT EXISTS client_user_id uuid,
  ADD COLUMN IF NOT EXISTS requested_trainer_id uuid REFERENCES public.instructors(id),
  ADD COLUMN IF NOT EXISTS pt_session_type_id uuid REFERENCES public.pt_session_types(id),
  ADD COLUMN IF NOT EXISTS preferred_date date,
  ADD COLUMN IF NOT EXISTS preferred_time time,
  ADD COLUMN IF NOT EXISTS flexibility_note text,
  ADD COLUMN IF NOT EXISTS client_note text,
  ADD COLUMN IF NOT EXISTS request_status text NOT NULL DEFAULT 'requested',
  ADD COLUMN IF NOT EXISTS alt_date date,
  ADD COLUMN IF NOT EXISTS alt_time time,
  ADD COLUMN IF NOT EXISTS alt_trainer_id uuid REFERENCES public.instructors(id),
  ADD COLUMN IF NOT EXISTS alt_note text,
  ADD COLUMN IF NOT EXISTS offered_at timestamptz,
  ADD COLUMN IF NOT EXISTS offered_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid,
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS appointment_id uuid UNIQUE REFERENCES public.pt_appointments(id) ON DELETE SET NULL;
ALTER TABLE public.training_requests ADD CONSTRAINT training_requests_request_status_chk
  CHECK (request_status IN ('requested','under_review','alternate_offered','confirmed','declined','cancelled'));
COMMENT ON COLUMN public.training_requests.status IS 'DEPRECATED: replaced by request_status (Phase 2D.1)';
CREATE INDEX IF NOT EXISTS training_requests_client_idx ON public.training_requests(client_user_id);
CREATE INDEX IF NOT EXISTS training_requests_status_idx ON public.training_requests(request_status, created_at);

CREATE POLICY "Clients read own training requests" ON public.training_requests FOR SELECT TO authenticated
  USING (client_user_id = auth.uid() OR submitted_by_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.pt_request_is_manager() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) $$;

CREATE OR REPLACE FUNCTION public.pt_request_can_act(_r public.training_requests) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.pt_request_is_manager() OR EXISTS (
    SELECT 1 FROM public.instructors i WHERE i.user_id = auth.uid() AND i.is_active
      AND i.id IN (_r.requested_trainer_id, _r.alt_trainer_id)) $$;

CREATE OR REPLACE FUNCTION public.pt_request_create(p_session_type_id uuid, p_trainer_id uuid, p_preferred_date date, p_preferred_time time, p_flexibility_note text DEFAULT NULL, p_client_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid := auth.uid(); v_p record; v_st record; v_id uuid; v_member boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to request a session'; END IF;
  SELECT * INTO v_st FROM pt_session_types WHERE id = p_session_type_id AND is_active;
  IF v_st.id IS NULL THEN RAISE EXCEPTION 'Unknown session type'; END IF;
  IF p_preferred_date IS NULL OR p_preferred_date < (now() AT TIME ZONE 'America/Detroit')::date THEN RAISE EXCEPTION 'Choose a future date'; END IF;
  SELECT first_name, last_name, email, phone INTO v_p FROM profiles WHERE user_id = v_uid;
  v_member := EXISTS (SELECT 1 FROM members m WHERE m.user_id = v_uid AND m.status <> 'cancelled');
  INSERT INTO training_requests(service, full_name, email, phone, is_member, status, submitted_by_user_id, client_user_id,
    requested_trainer_id, pt_session_type_id, preferred_date, preferred_time, flexibility_note, client_note, request_status)
  VALUES (v_st.name, trim(coalesce(v_p.first_name,'')||' '||coalesce(v_p.last_name,'')), coalesce(v_p.email, public.current_user_email()), coalesce(v_p.phone,''),
    v_member, 'new', v_uid, v_uid, p_trainer_id, p_session_type_id, p_preferred_date, p_preferred_time,
    left(p_flexibility_note, 500), left(p_client_note, 2000), 'requested')
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.pt_request_update(p_request_id uuid, p_action text, p_reason text DEFAULT NULL, p_trainer_id uuid DEFAULT NULL, p_alt_date date DEFAULT NULL, p_alt_time time DEFAULT NULL, p_client_user_id uuid DEFAULT NULL, p_session_type_id uuid DEFAULT NULL)
RETURNS public.training_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r training_requests;
BEGIN
  SELECT * INTO r FROM training_requests WHERE id = p_request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT pt_request_can_act(r) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF r.request_status IN ('confirmed','declined','cancelled') THEN RAISE EXCEPTION 'This request is already %', r.request_status; END IF;
  IF p_action = 'review' THEN
    UPDATE training_requests SET request_status='under_review', reviewed_at=now(), reviewed_by=auth.uid(), updated_at=now() WHERE id=r.id RETURNING * INTO r;
  ELSIF p_action = 'details' THEN
    IF NOT pt_request_is_manager() AND p_trainer_id IS DISTINCT FROM r.requested_trainer_id THEN RAISE EXCEPTION 'Only managers can reassign trainers'; END IF;
    UPDATE training_requests SET requested_trainer_id=coalesce(p_trainer_id, requested_trainer_id),
      client_user_id=coalesce(p_client_user_id, client_user_id), pt_session_type_id=coalesce(p_session_type_id, pt_session_type_id),
      preferred_date=coalesce(p_alt_date, preferred_date), preferred_time=coalesce(p_alt_time, preferred_time), updated_at=now()
    WHERE id=r.id RETURNING * INTO r;
  ELSIF p_action = 'offer_alternate' THEN
    IF p_alt_date IS NULL OR p_alt_time IS NULL THEN RAISE EXCEPTION 'Alternate date and time are required'; END IF;
    UPDATE training_requests SET request_status='alternate_offered', alt_date=p_alt_date, alt_time=p_alt_time,
      alt_trainer_id=coalesce(p_trainer_id, requested_trainer_id), alt_note=left(p_reason,1000), offered_at=now(), offered_by=auth.uid(), updated_at=now()
    WHERE id=r.id RETURNING * INTO r;
  ELSIF p_action = 'decline' THEN
    IF coalesce(trim(p_reason),'') = '' THEN RAISE EXCEPTION 'An internal reason is required to decline'; END IF;
    UPDATE training_requests SET request_status='declined', decline_reason=left(p_reason,1000), resolved_at=now(), resolved_by=auth.uid(), updated_at=now() WHERE id=r.id RETURNING * INTO r;
  ELSIF p_action = 'cancel' THEN
    UPDATE training_requests SET request_status='cancelled', decline_reason=left(p_reason,1000), resolved_at=now(), resolved_by=auth.uid(), updated_at=now() WHERE id=r.id RETURNING * INTO r;
  ELSE RAISE EXCEPTION 'Unknown action'; END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.pt_request_confirm(p_request_id uuid, p_use_alternate boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r training_requests; st pt_session_types; v_date date; v_time time; v_trainer uuid; v_start timestamptz; v_end timestamptz;
  c record; v_appt pt_appointments; v_has_pass boolean;
BEGIN
  SELECT * INTO r FROM training_requests WHERE id = p_request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT pt_request_can_act(r) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF r.request_status = 'confirmed' OR r.appointment_id IS NOT NULL THEN
    RETURN jsonb_build_object('appointment_id', r.appointment_id, 'already_confirmed', true);
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
    AND sessions_remaining > 0 AND expires_at >= (now() AT TIME ZONE 'America/Detroit')::date);
  v_appt := public.book_pt_appointment(r.client_user_id, st.format, v_start, st.duration_minutes, v_trainer,
    coalesce(r.client_note, r.goals), NULL, NOT v_has_pass, coalesce(st.default_price_cents,0), st.default_location_id, true);
  UPDATE pt_appointments SET session_type_id = st.id WHERE id = v_appt.id;
  UPDATE training_requests SET request_status='confirmed', appointment_id=v_appt.id, requested_trainer_id=v_trainer,
    resolved_at=now(), resolved_by=auth.uid(), updated_at=now() WHERE id = r.id;
  RETURN jsonb_build_object('appointment_id', v_appt.id, 'already_confirmed', false, 'package_used', v_has_pass);
END $$;

REVOKE EXECUTE ON FUNCTION public.pt_request_create(uuid,uuid,date,time,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pt_request_update(uuid,text,text,uuid,date,time,uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pt_request_confirm(uuid,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.pt_request_create(uuid,uuid,date,time,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pt_request_update(uuid,text,text,uuid,date,time,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pt_request_confirm(uuid,boolean) TO authenticated;