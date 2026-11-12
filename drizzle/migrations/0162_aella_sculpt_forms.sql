-- Preparation text per spa service (shown on confirmation, emails, reminders, appointment details).
ALTER TABLE public.spa_services ADD COLUMN IF NOT EXISTS preparation jsonb;
COMMENT ON COLUMN public.spa_services.preparation IS '{title, short: text[], link_label, full_title, full: [{heading, body}]} — client preparation instructions; NULL = none.';

-- Editable screening questions (owner: add, edit, deactivate, set review/hold answers).
CREATE TABLE IF NOT EXISTS public.spa_screening_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key text NOT NULL,
  section text NOT NULL DEFAULT 'Health screening',
  title text,
  prompt text NOT NULL,
  answer_type text NOT NULL CHECK (answer_type IN ('yes_no','yes_no_unsure','multi','text')),
  options text[],
  exclusive_option text,
  detail_prompt text,
  detail_on text[] NOT NULL DEFAULT '{}',
  review_on text[] NOT NULL DEFAULT '{}',
  hold_on text[] NOT NULL DEFAULT '{}',
  zone_ids uuid[],
  parent_id uuid REFERENCES public.spa_screening_questions(id) ON DELETE CASCADE,
  show_when text[],
  is_required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.spa_screening_questions.review_on IS 'Answers that require provider review.';
COMMENT ON COLUMN public.spa_screening_questions.hold_on IS 'Answers that prevent automatic clearance (review required; not cleared until a provider clears).';
COMMENT ON COLUMN public.spa_screening_questions.zone_ids IS 'Review/hold only applies when the appointment zone is in this list; NULL = every zone.';
CREATE INDEX IF NOT EXISTS spa_screening_questions_service_idx ON public.spa_screening_questions (service_key, sort_order);
GRANT SELECT ON public.spa_screening_questions TO authenticated;
GRANT INSERT, UPDATE ON public.spa_screening_questions TO authenticated;
GRANT ALL ON public.spa_screening_questions TO service_role;
ALTER TABLE public.spa_screening_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read screening questions" ON public.spa_screening_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers add screening questions" ON public.spa_screening_questions FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role]));
CREATE POLICY "Managers edit screening questions" ON public.spa_screening_questions FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role]));

-- Health & treatment intake (one per appointment; the latest one covers later visits).
CREATE TABLE IF NOT EXISTS public.spa_sculpt_intakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.spa_appointments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  member_id uuid,
  service_key text NOT NULL DEFAULT 'aella-sculpt',
  zone_name text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  answers_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  screening_level text NOT NULL DEFAULT 'clear' CHECK (screening_level IN ('clear','review','hold')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS spa_sculpt_intakes_user_idx ON public.spa_sculpt_intakes (user_id, service_key, updated_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.spa_sculpt_intakes TO authenticated;
GRANT ALL ON public.spa_sculpt_intakes TO service_role;
ALTER TABLE public.spa_sculpt_intakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients add own sculpt intake" ON public.spa_sculpt_intakes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Clients update own sculpt intake" ON public.spa_sculpt_intakes FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Clients view own sculpt intake" ON public.spa_sculpt_intakes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Spa providers view sculpt intakes" ON public.spa_sculpt_intakes FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role,'spa_staff'::app_role]));

-- Treatment consent (separate from photography consent).
CREATE TABLE IF NOT EXISTS public.spa_sculpt_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.spa_appointments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  member_id uuid,
  service_key text NOT NULL DEFAULT 'aella-sculpt',
  consent_version text NOT NULL,
  acknowledgements jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent_agreed boolean NOT NULL DEFAULT false,
  printed_name text NOT NULL,
  signature_image text NOT NULL,
  signed_on date NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  provider_ack_by uuid,
  provider_ack_name text,
  provider_ack_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS spa_sculpt_consents_user_idx ON public.spa_sculpt_consents (user_id, service_key, signed_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.spa_sculpt_consents TO authenticated;
GRANT ALL ON public.spa_sculpt_consents TO service_role;
ALTER TABLE public.spa_sculpt_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients add own sculpt consent" ON public.spa_sculpt_consents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Clients update own sculpt consent" ON public.spa_sculpt_consents FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Clients view own sculpt consent" ON public.spa_sculpt_consents FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Spa providers view sculpt consents" ON public.spa_sculpt_consents FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role,'spa_staff'::app_role]));
CREATE POLICY "Spa providers acknowledge sculpt consents" ON public.spa_sculpt_consents FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role,'spa_staff'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role,'spa_staff'::app_role]));

-- Optional progress-photography consent (private treatment record only; latest answer per client and service).
CREATE TABLE IF NOT EXISTS public.spa_photo_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service_key text NOT NULL,
  appointment_id uuid REFERENCES public.spa_appointments(id) ON DELETE SET NULL,
  consent boolean NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, service_key)
);
COMMENT ON TABLE public.spa_photo_consents IS 'Private treatment-record progress photos only; never authorizes marketing, social, website or advertising use.';
GRANT SELECT, INSERT, UPDATE ON public.spa_photo_consents TO authenticated;
GRANT ALL ON public.spa_photo_consents TO service_role;
ALTER TABLE public.spa_photo_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients add own photo consent" ON public.spa_photo_consents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Clients update own photo consent" ON public.spa_photo_consents FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Clients view own photo consent" ON public.spa_photo_consents FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Spa staff view photo consents" ON public.spa_photo_consents FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role,'spa_staff'::app_role]));

-- Provider screening decisions (internal; clients never read these). Latest row wins.
CREATE TABLE IF NOT EXISTS public.spa_screening_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id uuid NOT NULL REFERENCES public.spa_sculpt_intakes(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('cleared','not_cleared')),
  note text NOT NULL CHECK (length(btrim(note)) >= 3),
  reviewed_by uuid NOT NULL DEFAULT auth.uid(),
  reviewer_name text,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS spa_screening_reviews_intake_idx ON public.spa_screening_reviews (intake_id, reviewed_at DESC);
GRANT SELECT, INSERT ON public.spa_screening_reviews TO authenticated;
GRANT ALL ON public.spa_screening_reviews TO service_role;
ALTER TABLE public.spa_screening_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Spa providers view screening reviews" ON public.spa_screening_reviews FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role,'spa_staff'::app_role]));
CREATE POLICY "Spa providers record screening reviews" ON public.spa_screening_reviews FOR INSERT TO authenticated
  WITH CHECK (reviewed_by = auth.uid() AND public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role,'spa_staff'::app_role]));

-- Intake: verify the appointment, require every shown question, and grade answers from the saved rules.
CREATE OR REPLACE FUNCTION public.spa_sculpt_intake_screen()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_appt record;
  q record;
  v_ans jsonb;
  v_vals text[];
  v_level text := 'clear';
  v_qlevel text;
  v_snap jsonb := '[]'::jsonb;
  v_shown boolean;
  v_parent_vals text[];
  v_zone_ok boolean;
BEGIN
  SELECT a.user_id, a.member_id, a.treatment_zone_id, a.treatment_zone_name, s.service_key
    INTO v_appt
    FROM spa_appointments a LEFT JOIN spa_services s ON s.id::text = a.service_id::text
   WHERE a.id = NEW.appointment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  IF v_appt.user_id IS DISTINCT FROM NEW.user_id THEN RAISE EXCEPTION 'This appointment belongs to another account'; END IF;
  IF v_appt.service_key IS DISTINCT FROM NEW.service_key THEN RAISE EXCEPTION 'This form is for a different treatment'; END IF;
  NEW.member_id := v_appt.member_id;
  NEW.zone_name := v_appt.treatment_zone_name;

  FOR q IN SELECT * FROM spa_screening_questions WHERE service_key = NEW.service_key AND is_active ORDER BY sort_order, created_at LOOP
    -- Follow-up questions only count when their parent answer matches.
    v_shown := true;
    IF q.parent_id IS NOT NULL THEN
      v_ans := NEW.answers -> q.parent_id::text -> 'answer';
      v_parent_vals := CASE WHEN jsonb_typeof(v_ans) = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(v_ans))
                            WHEN v_ans IS NULL OR jsonb_typeof(v_ans) = 'null' THEN ARRAY[]::text[] ELSE ARRAY[v_ans #>> '{}'] END;
      v_shown := coalesce(q.show_when, '{}') && v_parent_vals;
    END IF;
    CONTINUE WHEN NOT v_shown;

    v_ans := NEW.answers -> q.id::text -> 'answer';
    v_vals := CASE WHEN jsonb_typeof(v_ans) = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(v_ans))
                   WHEN v_ans IS NULL OR jsonb_typeof(v_ans) = 'null' OR btrim(v_ans #>> '{}') = '' THEN ARRAY[]::text[]
                   ELSE ARRAY[v_ans #>> '{}'] END;
    IF q.is_required AND cardinality(v_vals) = 0 THEN
      RAISE EXCEPTION 'Please answer: %', q.prompt;
    END IF;

    v_zone_ok := q.zone_ids IS NULL OR v_appt.treatment_zone_id = ANY (q.zone_ids);
    v_qlevel := NULL;
    IF v_zone_ok AND q.hold_on && v_vals THEN v_qlevel := 'hold';
    ELSIF v_zone_ok AND q.review_on && v_vals THEN v_qlevel := 'review';
    END IF;
    IF v_qlevel = 'hold' THEN v_level := 'hold';
    ELSIF v_qlevel = 'review' AND v_level = 'clear' THEN v_level := 'review';
    END IF;

    v_snap := v_snap || jsonb_build_array(jsonb_build_object(
      'id', q.id, 'section', q.section, 'title', q.title, 'prompt', q.prompt,
      'answer', to_jsonb(v_vals), 'detail', NEW.answers -> q.id::text ->> 'detail',
      'detail_prompt', q.detail_prompt, 'flag', v_qlevel));
  END LOOP;

  NEW.answers_snapshot := v_snap;
  NEW.screening_level := v_level;
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN NEW.submitted_at := now(); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS spa_sculpt_intake_screen ON public.spa_sculpt_intakes;
CREATE TRIGGER spa_sculpt_intake_screen BEFORE INSERT OR UPDATE ON public.spa_sculpt_intakes
  FOR EACH ROW EXECUTE FUNCTION public.spa_sculpt_intake_screen();

-- Consent: verify appointment, require every section and the signature; only providers set the acknowledgement.
CREATE OR REPLACE FUNCTION public.spa_sculpt_consent_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_staff boolean := public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role,'spa_staff'::app_role]);
  v_user uuid; v_member uuid; v_key text; k text;
  v_required text[] := ARRAY['nature','not_weight_loss','results','responses','communication','health_info','no_guarantee','questions'];
BEGIN
  IF TG_OP = 'UPDATE' AND v_staff AND auth.uid() IS DISTINCT FROM OLD.user_id THEN
    -- Providers may only add their acknowledgement; the client's signed consent stays as signed.
    NEW := OLD;
    NEW.provider_ack_by := auth.uid();
    NEW.provider_ack_at := now();
    SELECT coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email) INTO NEW.provider_ack_name FROM profiles p WHERE p.user_id = auth.uid();
    RETURN NEW;
  END IF;

  SELECT a.user_id, a.member_id, s.service_key INTO v_user, v_member, v_key
    FROM spa_appointments a LEFT JOIN spa_services s ON s.id::text = a.service_id::text WHERE a.id = NEW.appointment_id;
  IF v_user IS DISTINCT FROM NEW.user_id THEN RAISE EXCEPTION 'This appointment belongs to another account'; END IF;
  IF v_key IS DISTINCT FROM NEW.service_key THEN RAISE EXCEPTION 'This consent is for a different treatment'; END IF;
  FOREACH k IN ARRAY v_required LOOP
    IF coalesce((NEW.acknowledgements ->> k)::boolean, false) IS NOT TRUE THEN RAISE EXCEPTION 'Please acknowledge every section'; END IF;
  END LOOP;
  IF NOT NEW.consent_agreed THEN RAISE EXCEPTION 'Please check the consent box'; END IF;
  IF length(btrim(NEW.printed_name)) < 2 OR length(NEW.signature_image) < 100 THEN RAISE EXCEPTION 'Please sign and print your name'; END IF;
  NEW.member_id := v_member;
  NEW.signed_at := now();
  NEW.updated_at := now();
  -- A client re-signing clears any earlier provider acknowledgement; clients can never set it.
  NEW.provider_ack_by := NULL; NEW.provider_ack_name := NULL; NEW.provider_ack_at := NULL;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS spa_sculpt_consent_guard ON public.spa_sculpt_consents;
CREATE TRIGGER spa_sculpt_consent_guard BEFORE INSERT OR UPDATE ON public.spa_sculpt_consents
  FOR EACH ROW EXECUTE FUNCTION public.spa_sculpt_consent_guard();

-- Reviewer name is stamped by the database.
CREATE OR REPLACE FUNCTION public.spa_screening_review_stamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.reviewed_by := auth.uid();
  NEW.reviewed_at := now();
  SELECT coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email) INTO NEW.reviewer_name FROM profiles p WHERE p.user_id = auth.uid();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS spa_screening_review_stamp ON public.spa_screening_reviews;
CREATE TRIGGER spa_screening_review_stamp BEFORE INSERT ON public.spa_screening_reviews
  FOR EACH ROW EXECUTE FUNCTION public.spa_screening_review_stamp();

-- Form status for appointments, safe for any staff role (no health answers) and for the client's own appointments.
CREATE OR REPLACE FUNCTION public.spa_sculpt_form_status(p_appointment_ids uuid[])
RETURNS TABLE (
  appointment_id uuid, intake_done boolean, consent_done boolean, provider_ack boolean, photo_consent boolean,
  review_state text, screening_level text, review_decision text, reviewed_by_name text, reviewed_at timestamptz, intake_appointment_id uuid
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_staff boolean := public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role,'spa_staff'::app_role,'front_desk'::app_role]);
BEGIN
  RETURN QUERY
  SELECT a.id,
         i.id IS NOT NULL,
         c.id IS NOT NULL,
         CASE WHEN v_staff THEN c.provider_ack_at IS NOT NULL ELSE NULL END,
         pc.consent,
         CASE WHEN NOT v_staff THEN NULL
              WHEN i.id IS NULL THEN 'pending'
              WHEN r.id IS NOT NULL THEN 'completed'
              WHEN i.screening_level = 'clear' THEN 'clear'
              ELSE 'required' END,
         CASE WHEN v_staff THEN i.screening_level ELSE NULL END,
         CASE WHEN v_staff THEN r.decision ELSE NULL END,
         CASE WHEN v_staff THEN r.reviewer_name ELSE NULL END,
         CASE WHEN v_staff THEN r.reviewed_at ELSE NULL END,
         i.appointment_id
    FROM spa_appointments a
    JOIN spa_services s ON s.id::text = a.service_id::text AND s.service_key IS NOT NULL
    LEFT JOIN LATERAL (SELECT * FROM spa_sculpt_intakes x WHERE x.user_id = a.user_id AND x.service_key = s.service_key ORDER BY x.updated_at DESC LIMIT 1) i ON true
    LEFT JOIN LATERAL (SELECT * FROM spa_sculpt_consents x WHERE x.user_id = a.user_id AND x.service_key = s.service_key ORDER BY x.signed_at DESC LIMIT 1) c ON true
    LEFT JOIN spa_photo_consents pc ON pc.user_id = a.user_id AND pc.service_key = s.service_key
    -- A review only counts if it was recorded after the intake's latest answers.
    LEFT JOIN LATERAL (SELECT * FROM spa_screening_reviews x WHERE x.intake_id = i.id AND x.reviewed_at >= i.updated_at ORDER BY x.reviewed_at DESC LIMIT 1) r ON true
   WHERE a.id = ANY (p_appointment_ids)
     AND (v_staff OR a.user_id = auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.spa_sculpt_form_status(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spa_sculpt_form_status(uuid[]) TO authenticated, service_role;