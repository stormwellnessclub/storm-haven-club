
-- ============ 1. REFERENCE DATA ============
CREATE TABLE IF NOT EXISTS public.pt_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  address text,
  color text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pt_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_locations TO authenticated;
GRANT ALL ON public.pt_locations TO service_role;
ALTER TABLE public.pt_locations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.pt_session_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  description text,
  format public.pt_format,
  duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  capacity integer NOT NULL DEFAULT 1 CHECK (capacity > 0),
  requires_package boolean NOT NULL DEFAULT true,
  required_format public.pt_format,
  default_location_id uuid REFERENCES public.pt_locations(id) ON DELETE SET NULL,
  default_price_cents integer NOT NULL DEFAULT 0,
  color text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_session_types TO authenticated;
GRANT ALL ON public.pt_session_types TO service_role;
ALTER TABLE public.pt_session_types ENABLE ROW LEVEL SECURITY;

-- ============ 2. TRAINER EXTENSIONS ============
ALTER TABLE public.instructors
  ADD COLUMN IF NOT EXISTS employment_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS schedule_color text,
  ADD COLUMN IF NOT EXISTS can_self_book boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_edit_others_appointments boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_location_id uuid REFERENCES public.pt_locations(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE public.instructors ADD CONSTRAINT instructors_employment_status_chk
    CHECK (employment_status IN ('active','inactive','on_leave','terminated','contractor'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.pt_trainer_locations (
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.pt_locations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instructor_id, location_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_trainer_locations TO authenticated;
GRANT ALL ON public.pt_trainer_locations TO service_role;
ALTER TABLE public.pt_trainer_locations ENABLE ROW LEVEL SECURITY;

-- ============ 3. CLIENT <-> TRAINER ASSIGNMENTS ============
CREATE TABLE IF NOT EXISTS public.pt_client_trainers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL,
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'secondary' CHECK (relationship IN ('primary','secondary','covering')),
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  UNIQUE (client_user_id, instructor_id)
);
CREATE INDEX IF NOT EXISTS pt_client_trainers_client_idx ON public.pt_client_trainers(client_user_id);
CREATE INDEX IF NOT EXISTS pt_client_trainers_instructor_idx ON public.pt_client_trainers(instructor_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_client_trainers TO authenticated;
GRANT ALL ON public.pt_client_trainers TO service_role;
ALTER TABLE public.pt_client_trainers ENABLE ROW LEVEL SECURITY;

-- ============ 4. ACCESS HELPERS ============
CREATE OR REPLACE FUNCTION public.pt_my_instructor_id(_uid uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.instructors WHERE user_id = _uid LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.pt_is_desk(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(_uid, ARRAY['admin','super_admin','manager','front_desk']::app_role[]);
$$;

CREATE OR REPLACE FUNCTION public.pt_can_view_client(_uid uuid, _client uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.pt_is_desk(_uid)
    OR EXISTS (SELECT 1 FROM public.pt_client_profiles p JOIN public.instructors i ON i.id = p.primary_trainer_id
               WHERE p.user_id = _client AND i.user_id = _uid)
    OR EXISTS (SELECT 1 FROM public.pt_client_trainers ct JOIN public.instructors i ON i.id = ct.instructor_id
               WHERE ct.client_user_id = _client AND ct.ended_at IS NULL AND i.user_id = _uid)
    OR EXISTS (SELECT 1 FROM public.pt_appointments a JOIN public.instructors i ON i.id = a.instructor_id
               WHERE a.user_id = _client AND i.user_id = _uid);
$$;

CREATE OR REPLACE FUNCTION public.pt_can_coach_client(_uid uuid, _client uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.pt_is_staff(_uid)
    OR EXISTS (SELECT 1 FROM public.pt_client_profiles p JOIN public.instructors i ON i.id = p.primary_trainer_id
               WHERE p.user_id = _client AND i.user_id = _uid)
    OR EXISTS (SELECT 1 FROM public.pt_client_trainers ct JOIN public.instructors i ON i.id = ct.instructor_id
               WHERE ct.client_user_id = _client AND ct.ended_at IS NULL AND i.user_id = _uid)
    OR EXISTS (SELECT 1 FROM public.pt_appointments a JOIN public.instructors i ON i.id = a.instructor_id
               WHERE a.user_id = _client AND i.user_id = _uid);
$$;

REVOKE EXECUTE ON FUNCTION public.pt_my_instructor_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pt_is_desk(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pt_can_view_client(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pt_can_coach_client(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pt_my_instructor_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_is_desk(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_can_view_client(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pt_can_coach_client(uuid, uuid) TO authenticated, service_role;

-- ============ 5. CLIENT PROFILE EXTENSIONS ============
ALTER TABLE public.pt_client_profiles
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship text,
  ADD COLUMN IF NOT EXISTS height_inches numeric(5,2),
  ADD COLUMN IF NOT EXISTS weight_lbs numeric(6,2),
  ADD COLUMN IF NOT EXISTS body_fat_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS injuries jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS medical_notes text,
  ADD COLUMN IF NOT EXISTS training_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS communication_prefs jsonb NOT NULL DEFAULT '{"email":true,"sms":false,"push":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS parq_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS parq_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS parq_expires_at date,
  ADD COLUMN IF NOT EXISTS medical_clearance_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_location_id uuid REFERENCES public.pt_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

DO $$ BEGIN
  ALTER TABLE public.pt_client_profiles ADD CONSTRAINT pt_client_profiles_parq_chk
    CHECK (parq_status IN ('not_started','pending','completed','expired','cleared','flagged'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.pt_client_profiles ADD CONSTRAINT pt_client_profiles_status_chk
    CHECK (status IN ('active','prospect','paused','inactive','archived'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS pt_client_profiles_trainer_idx ON public.pt_client_profiles(primary_trainer_id);
CREATE INDEX IF NOT EXISTS pt_client_profiles_status_idx ON public.pt_client_profiles(status);
CREATE INDEX IF NOT EXISTS pt_client_profiles_tags_idx ON public.pt_client_profiles USING gin(tags);

-- ============ 6. APPOINTMENT EXTENSIONS ============
ALTER TABLE public.pt_appointments
  ADD COLUMN IF NOT EXISTS session_type_id uuid REFERENCES public.pt_session_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.pt_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmation_status text NOT NULL DEFAULT 'unconfirmed',
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS no_show_at timestamptz,
  ADD COLUMN IF NOT EXISTS waitlist_position integer,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS package_deducted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS package_deducted_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.pt_appointments ADD CONSTRAINT pt_appointments_confirmation_chk
    CHECK (confirmation_status IN ('unconfirmed','confirmed','declined','reminded'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.pt_appointments ADD CONSTRAINT pt_appointments_time_chk CHECK (ends_at > starts_at);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS pt_appointments_location_idx ON public.pt_appointments(location_id);
CREATE INDEX IF NOT EXISTS pt_appointments_session_type_idx ON public.pt_appointments(session_type_id);
CREATE INDEX IF NOT EXISTS pt_appointments_instructor_day_idx ON public.pt_appointments(instructor_id, starts_at);

-- trainers can read/manage their own appointments
DROP POLICY IF EXISTS "Trainers view own PT appointments" ON public.pt_appointments;
CREATE POLICY "Trainers view own PT appointments" ON public.pt_appointments FOR SELECT TO authenticated
USING (instructor_id = public.pt_my_instructor_id(auth.uid()));
DROP POLICY IF EXISTS "Trainers update own PT appointments" ON public.pt_appointments;
CREATE POLICY "Trainers update own PT appointments" ON public.pt_appointments FOR UPDATE TO authenticated
USING (instructor_id = public.pt_my_instructor_id(auth.uid()))
WITH CHECK (instructor_id = public.pt_my_instructor_id(auth.uid()));

-- ============ 7. PACKAGE ADJUSTMENTS / LEDGER ============
CREATE TABLE IF NOT EXISTS public.pt_pass_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id uuid NOT NULL REFERENCES public.pt_passes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  delta_sessions integer NOT NULL,
  sessions_before integer,
  sessions_after integer,
  adjustment_type text NOT NULL DEFAULT 'manual'
    CHECK (adjustment_type IN ('manual','comp','refund','expiration_change','transfer','correction','purchase','usage')),
  reason text NOT NULL,
  expires_at_before date,
  expires_at_after date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pt_pass_adjustments_pass_idx ON public.pt_pass_adjustments(pass_id);
CREATE INDEX IF NOT EXISTS pt_pass_adjustments_user_idx ON public.pt_pass_adjustments(user_id);
GRANT SELECT, INSERT ON public.pt_pass_adjustments TO authenticated;
GRANT ALL ON public.pt_pass_adjustments TO service_role;
ALTER TABLE public.pt_pass_adjustments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pt_passes
  ADD COLUMN IF NOT EXISTS purchased_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS session_type_id uuid REFERENCES public.pt_session_types(id) ON DELETE SET NULL;

-- ============ 8. PROGRAM / WORKOUT EXTENSIONS ============
ALTER TABLE public.pt_programs
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS weekly_split jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.pt_programs(id) ON DELETE SET NULL;

ALTER TABLE public.pt_program_exercises
  ADD COLUMN IF NOT EXISTS rpe numeric(4,1),
  ADD COLUMN IF NOT EXISTS modification text,
  ADD COLUMN IF NOT EXISTS completed_result text,
  ADD COLUMN IF NOT EXISTS previous_result text,
  ADD COLUMN IF NOT EXISTS is_pr boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS exercise_id uuid REFERENCES public.pt_exercise_library(id) ON DELETE SET NULL;

-- ============ 9. SESSION NOTE EXTENSIONS ============
ALTER TABLE public.pt_session_notes
  ADD COLUMN IF NOT EXISTS exercise_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS private_note text,
  ADD COLUMN IF NOT EXISTS updated_by uuid;
CREATE INDEX IF NOT EXISTS pt_session_notes_user_idx ON public.pt_session_notes(user_id);
CREATE INDEX IF NOT EXISTS pt_session_notes_instructor_idx ON public.pt_session_notes(instructor_id);

-- ============ 10. PROGRESS ============
CREATE TABLE IF NOT EXISTS public.pt_progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  storage_path text NOT NULL,
  pose text,
  taken_on date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Detroit')::date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pt_progress_photos_user_idx ON public.pt_progress_photos(user_id, taken_on DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_progress_photos TO authenticated;
GRANT ALL ON public.pt_progress_photos TO service_role;
ALTER TABLE public.pt_progress_photos ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.pt_performance_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  test_name text NOT NULL,
  category text,
  value numeric(10,2),
  unit text,
  result_text text,
  is_reassessment boolean NOT NULL DEFAULT false,
  tested_on date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Detroit')::date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pt_performance_tests_user_idx ON public.pt_performance_tests(user_id, tested_on DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_performance_tests TO authenticated;
GRANT ALL ON public.pt_performance_tests TO service_role;
ALTER TABLE public.pt_performance_tests ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.pt_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  milestone_type text,
  achieved_on date,
  target_date date,
  is_achieved boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pt_milestones_user_idx ON public.pt_milestones(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_milestones TO authenticated;
GRANT ALL ON public.pt_milestones TO service_role;
ALTER TABLE public.pt_milestones ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pt_body_metrics
  ADD COLUMN IF NOT EXISTS neck_in numeric(5,2),
  ADD COLUMN IF NOT EXISTS calves_in numeric(5,2),
  ADD COLUMN IF NOT EXISTS extra jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ============ 11. ALERTS ============
CREATE TABLE IF NOT EXISTS public.pt_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid,
  instructor_id uuid REFERENCES public.instructors(id) ON DELETE SET NULL,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','low','medium','high','critical')),
  message text NOT NULL,
  due_date date,
  assigned_to uuid,
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pt_alerts_open_idx ON public.pt_alerts(is_resolved, due_date);
CREATE INDEX IF NOT EXISTS pt_alerts_client_idx ON public.pt_alerts(client_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_alerts TO authenticated;
GRANT ALL ON public.pt_alerts TO service_role;
ALTER TABLE public.pt_alerts ENABLE ROW LEVEL SECURITY;

-- ============ 12. TASK EXTENSIONS ============
ALTER TABLE public.pt_tasks
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.pt_appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'todo';
DO $$ BEGIN
  ALTER TABLE public.pt_tasks ADD CONSTRAINT pt_tasks_status_chk CHECK (status IN ('todo','in_progress','done','cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS pt_tasks_assigned_idx ON public.pt_tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS pt_tasks_client_idx ON public.pt_tasks(client_user_id);

-- ============ 13. FORMS & DOCUMENTS ============
CREATE TABLE IF NOT EXISTS public.pt_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  doc_type text NOT NULL CHECK (doc_type IN ('parq','waiver','assessment','medical_clearance','agreement','upload','other')),
  title text NOT NULL,
  storage_path text,
  external_url text,
  form_data jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','expired','declined','void')),
  completed_at timestamptz,
  expires_at date,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pt_documents_user_idx ON public.pt_documents(user_id, doc_type);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_documents TO authenticated;
GRANT ALL ON public.pt_documents TO service_role;
ALTER TABLE public.pt_documents ENABLE ROW LEVEL SECURITY;

-- ============ 14. COMMUNICATIONS ============
CREATE TABLE IF NOT EXISTS public.pt_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL,
  instructor_id uuid REFERENCES public.instructors(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.pt_appointments(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('email','sms','push','in_app','phone','internal')),
  direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound','inbound','internal')),
  subject text,
  body text,
  delivery_status text NOT NULL DEFAULT 'queued'
    CHECK (delivery_status IN ('queued','sent','delivered','failed','bounced','read','logged')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pt_communications_client_idx ON public.pt_communications(client_user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.pt_communications TO authenticated;
GRANT ALL ON public.pt_communications TO service_role;
ALTER TABLE public.pt_communications ENABLE ROW LEVEL SECURITY;

-- ============ 15. AUDIT HISTORY ============
CREATE TABLE IF NOT EXISTS public.pt_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid,
  client_user_id uuid,
  action text NOT NULL,
  changed_fields text[],
  before_data jsonb,
  after_data jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pt_audit_log_entity_idx ON public.pt_audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pt_audit_log_client_idx ON public.pt_audit_log(client_user_id, created_at DESC);
GRANT SELECT ON public.pt_audit_log TO authenticated;
GRANT ALL ON public.pt_audit_log TO service_role;
ALTER TABLE public.pt_audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.pt_audit_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_before jsonb; v_after jsonb; v_changed text[]; v_client uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_before := NULL; v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_before := to_jsonb(OLD); v_after := to_jsonb(NEW);
    SELECT array_agg(key) INTO v_changed
      FROM jsonb_each(v_after) e(key, val)
      WHERE v_before -> e.key IS DISTINCT FROM e.val;
    IF v_changed IS NULL OR array_length(v_changed,1) IS NULL THEN RETURN NEW; END IF;
  ELSE
    v_before := to_jsonb(OLD); v_after := NULL;
  END IF;

  v_client := COALESCE((v_after ->> 'user_id')::uuid, (v_before ->> 'user_id')::uuid);

  INSERT INTO public.pt_audit_log(entity_type, entity_id, client_user_id, action, changed_fields, before_data, after_data, actor_id)
  VALUES (TG_TABLE_NAME,
          COALESCE((v_after ->> 'id')::uuid, (v_before ->> 'id')::uuid),
          v_client, lower(TG_OP), v_changed, v_before, v_after, auth.uid());

  RETURN COALESCE(NEW, OLD);
END; $$;
REVOKE EXECUTE ON FUNCTION public.pt_audit_trigger() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS pt_audit_appointments ON public.pt_appointments;
CREATE TRIGGER pt_audit_appointments AFTER INSERT OR UPDATE OR DELETE ON public.pt_appointments
FOR EACH ROW EXECUTE FUNCTION public.pt_audit_trigger();

DROP TRIGGER IF EXISTS pt_audit_passes ON public.pt_passes;
CREATE TRIGGER pt_audit_passes AFTER INSERT OR UPDATE OR DELETE ON public.pt_passes
FOR EACH ROW EXECUTE FUNCTION public.pt_audit_trigger();

DROP TRIGGER IF EXISTS pt_audit_client_profiles ON public.pt_client_profiles;
CREATE TRIGGER pt_audit_client_profiles AFTER INSERT OR UPDATE OR DELETE ON public.pt_client_profiles
FOR EACH ROW EXECUTE FUNCTION public.pt_audit_trigger();

-- ============ 16. UPDATED_AT TRIGGERS ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pt_locations','pt_session_types','pt_milestones','pt_alerts','pt_documents'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_updated_at', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t || '_updated_at', t);
  END LOOP;
END $$;

-- ============ 17. RLS POLICIES ============
-- reference data: all authenticated staff read, management writes
DROP POLICY IF EXISTS "read pt locations" ON public.pt_locations;
CREATE POLICY "read pt locations" ON public.pt_locations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage pt locations" ON public.pt_locations;
CREATE POLICY "manage pt locations" ON public.pt_locations FOR ALL TO authenticated
USING (public.pt_is_staff(auth.uid())) WITH CHECK (public.pt_is_staff(auth.uid()));

DROP POLICY IF EXISTS "read pt session types" ON public.pt_session_types;
CREATE POLICY "read pt session types" ON public.pt_session_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage pt session types" ON public.pt_session_types;
CREATE POLICY "manage pt session types" ON public.pt_session_types FOR ALL TO authenticated
USING (public.pt_is_staff(auth.uid())) WITH CHECK (public.pt_is_staff(auth.uid()));

DROP POLICY IF EXISTS "read pt trainer locations" ON public.pt_trainer_locations;
CREATE POLICY "read pt trainer locations" ON public.pt_trainer_locations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "manage pt trainer locations" ON public.pt_trainer_locations;
CREATE POLICY "manage pt trainer locations" ON public.pt_trainer_locations FOR ALL TO authenticated
USING (public.pt_is_staff(auth.uid())) WITH CHECK (public.pt_is_staff(auth.uid()));

-- client/trainer assignments
DROP POLICY IF EXISTS "view pt client trainers" ON public.pt_client_trainers;
CREATE POLICY "view pt client trainers" ON public.pt_client_trainers FOR SELECT TO authenticated
USING (public.pt_is_desk(auth.uid()) OR instructor_id = public.pt_my_instructor_id(auth.uid()) OR client_user_id = auth.uid());
DROP POLICY IF EXISTS "manage pt client trainers" ON public.pt_client_trainers;
CREATE POLICY "manage pt client trainers" ON public.pt_client_trainers FOR ALL TO authenticated
USING (public.pt_is_staff(auth.uid())) WITH CHECK (public.pt_is_staff(auth.uid()));

-- package adjustments
DROP POLICY IF EXISTS "view pt pass adjustments" ON public.pt_pass_adjustments;
CREATE POLICY "view pt pass adjustments" ON public.pt_pass_adjustments FOR SELECT TO authenticated
USING (public.pt_is_desk(auth.uid()) OR user_id = auth.uid());
DROP POLICY IF EXISTS "insert pt pass adjustments" ON public.pt_pass_adjustments;
CREATE POLICY "insert pt pass adjustments" ON public.pt_pass_adjustments FOR INSERT TO authenticated
WITH CHECK (public.pt_is_desk(auth.uid()) AND created_by = auth.uid());

-- progress photos (client-scoped)
DROP POLICY IF EXISTS "view pt progress photos" ON public.pt_progress_photos;
CREATE POLICY "view pt progress photos" ON public.pt_progress_photos FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.pt_can_coach_client(auth.uid(), user_id));
DROP POLICY IF EXISTS "manage pt progress photos" ON public.pt_progress_photos;
CREATE POLICY "manage pt progress photos" ON public.pt_progress_photos FOR ALL TO authenticated
USING (public.pt_can_coach_client(auth.uid(), user_id)) WITH CHECK (public.pt_can_coach_client(auth.uid(), user_id));

DROP POLICY IF EXISTS "view pt performance tests" ON public.pt_performance_tests;
CREATE POLICY "view pt performance tests" ON public.pt_performance_tests FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.pt_can_view_client(auth.uid(), user_id));
DROP POLICY IF EXISTS "manage pt performance tests" ON public.pt_performance_tests;
CREATE POLICY "manage pt performance tests" ON public.pt_performance_tests FOR ALL TO authenticated
USING (public.pt_can_coach_client(auth.uid(), user_id)) WITH CHECK (public.pt_can_coach_client(auth.uid(), user_id));

DROP POLICY IF EXISTS "view pt milestones" ON public.pt_milestones;
CREATE POLICY "view pt milestones" ON public.pt_milestones FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.pt_can_view_client(auth.uid(), user_id));
DROP POLICY IF EXISTS "manage pt milestones" ON public.pt_milestones;
CREATE POLICY "manage pt milestones" ON public.pt_milestones FOR ALL TO authenticated
USING (public.pt_can_coach_client(auth.uid(), user_id)) WITH CHECK (public.pt_can_coach_client(auth.uid(), user_id));

-- alerts
DROP POLICY IF EXISTS "view pt alerts" ON public.pt_alerts;
CREATE POLICY "view pt alerts" ON public.pt_alerts FOR SELECT TO authenticated
USING (public.pt_is_desk(auth.uid())
       OR assigned_to = auth.uid()
       OR instructor_id = public.pt_my_instructor_id(auth.uid())
       OR (client_user_id IS NOT NULL AND public.pt_can_coach_client(auth.uid(), client_user_id)));
DROP POLICY IF EXISTS "manage pt alerts" ON public.pt_alerts;
CREATE POLICY "manage pt alerts" ON public.pt_alerts FOR ALL TO authenticated
USING (public.pt_is_desk(auth.uid()) OR assigned_to = auth.uid() OR instructor_id = public.pt_my_instructor_id(auth.uid()))
WITH CHECK (public.pt_is_desk(auth.uid()) OR assigned_to = auth.uid() OR instructor_id = public.pt_my_instructor_id(auth.uid()));

-- documents
DROP POLICY IF EXISTS "view pt documents" ON public.pt_documents;
CREATE POLICY "view pt documents" ON public.pt_documents FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.pt_can_view_client(auth.uid(), user_id));
DROP POLICY IF EXISTS "manage pt documents" ON public.pt_documents;
CREATE POLICY "manage pt documents" ON public.pt_documents FOR ALL TO authenticated
USING (public.pt_is_desk(auth.uid()) OR public.pt_can_coach_client(auth.uid(), user_id))
WITH CHECK (public.pt_is_desk(auth.uid()) OR public.pt_can_coach_client(auth.uid(), user_id));

-- communications
DROP POLICY IF EXISTS "view pt communications" ON public.pt_communications;
CREATE POLICY "view pt communications" ON public.pt_communications FOR SELECT TO authenticated
USING (public.pt_is_desk(auth.uid()) OR public.pt_can_coach_client(auth.uid(), client_user_id));
DROP POLICY IF EXISTS "write pt communications" ON public.pt_communications;
CREATE POLICY "write pt communications" ON public.pt_communications FOR INSERT TO authenticated
WITH CHECK (public.pt_is_desk(auth.uid()) OR public.pt_can_coach_client(auth.uid(), client_user_id));
DROP POLICY IF EXISTS "update pt communications" ON public.pt_communications;
CREATE POLICY "update pt communications" ON public.pt_communications FOR UPDATE TO authenticated
USING (public.pt_is_staff(auth.uid())) WITH CHECK (public.pt_is_staff(auth.uid()));

-- audit log: management + trainers for their clients (read only)
DROP POLICY IF EXISTS "view pt audit log" ON public.pt_audit_log;
CREATE POLICY "view pt audit log" ON public.pt_audit_log FOR SELECT TO authenticated
USING (public.pt_is_staff(auth.uid())
       OR (client_user_id IS NOT NULL AND public.pt_can_coach_client(auth.uid(), client_user_id)));

-- ============ 18. SEED DEFAULTS ============
INSERT INTO public.pt_locations (name, code, color, display_order)
SELECT 'Storm Wellness Club', 'main', '#B3915F', 0
WHERE NOT EXISTS (SELECT 1 FROM public.pt_locations);

INSERT INTO public.pt_session_types (name, code, format, duration_minutes, capacity, required_format, display_order)
SELECT * FROM (VALUES
  ('Personal Training','pt','one_on_one'::public.pt_format,60,1,'one_on_one'::public.pt_format,0),
  ('Reformer 1:1','reformer','reformer_one_on_one'::public.pt_format,60,1,'reformer_one_on_one'::public.pt_format,1),
  ('Semi-Private Training','semi_private','semi_private'::public.pt_format,60,3,'semi_private'::public.pt_format,2),
  ('Assessment','assessment','one_on_one'::public.pt_format,45,1,NULL::public.pt_format,3),
  ('Consultation','consultation','one_on_one'::public.pt_format,30,1,NULL::public.pt_format,4)
) v(name, code, format, duration_minutes, capacity, required_format, display_order)
WHERE NOT EXISTS (SELECT 1 FROM public.pt_session_types);

UPDATE public.pt_session_types SET requires_package = false WHERE code IN ('assessment','consultation');

-- backfill assignments from existing primary trainers
INSERT INTO public.pt_client_trainers (client_user_id, instructor_id, relationship)
SELECT p.user_id, p.primary_trainer_id, 'primary'
FROM public.pt_client_profiles p
WHERE p.primary_trainer_id IS NOT NULL
ON CONFLICT (client_user_id, instructor_id) DO NOTHING;
