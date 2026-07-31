-- Appointment additions
ALTER TABLE public.pt_appointments
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_waitlist boolean NOT NULL DEFAULT false;

-- Helper predicate
CREATE OR REPLACE FUNCTION public.pt_is_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(_uid, ARRAY['admin','super_admin','manager']::app_role[]);
$$;

CREATE OR REPLACE FUNCTION public.pt_is_staff_or_desk(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(_uid, ARRAY['admin','super_admin','manager','front_desk','class_instructor']::app_role[]);
$$;

-- Tasks
CREATE TABLE IF NOT EXISTS public.pt_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  detail text,
  task_type text NOT NULL DEFAULT 'task',
  priority task_priority NOT NULL DEFAULT 'medium',
  due_at timestamptz,
  client_user_id uuid,
  instructor_id uuid REFERENCES public.instructors(id) ON DELETE SET NULL,
  assigned_to uuid,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_tasks TO authenticated;
GRANT ALL ON public.pt_tasks TO service_role;
ALTER TABLE public.pt_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage PT tasks" ON public.pt_tasks FOR ALL TO authenticated
  USING (public.pt_is_staff_or_desk(auth.uid())) WITH CHECK (public.pt_is_staff_or_desk(auth.uid()));

-- Client profiles
CREATE TABLE IF NOT EXISTS public.pt_client_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  primary_trainer_id uuid REFERENCES public.instructors(id) ON DELETE SET NULL,
  date_of_birth date,
  gender text,
  height text,
  goals jsonb NOT NULL DEFAULT '[]'::jsonb,
  restrictions jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  internal_notes text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_client_profiles TO authenticated;
GRANT ALL ON public.pt_client_profiles TO service_role;
ALTER TABLE public.pt_client_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage PT client profiles" ON public.pt_client_profiles FOR ALL TO authenticated
  USING (public.pt_is_staff_or_desk(auth.uid())) WITH CHECK (public.pt_is_staff_or_desk(auth.uid()));

-- Body metrics
CREATE TABLE IF NOT EXISTS public.pt_body_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  measured_on date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Detroit')::date,
  weight_lbs numeric,
  body_fat_pct numeric,
  muscle_mass_lbs numeric,
  waist_in numeric,
  chest_in numeric,
  hips_in numeric,
  arms_in numeric,
  thighs_in numeric,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pt_body_metrics_user_idx ON public.pt_body_metrics(user_id, measured_on DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_body_metrics TO authenticated;
GRANT ALL ON public.pt_body_metrics TO service_role;
ALTER TABLE public.pt_body_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage PT body metrics" ON public.pt_body_metrics FOR ALL TO authenticated
  USING (public.pt_is_staff_or_desk(auth.uid())) WITH CHECK (public.pt_is_staff_or_desk(auth.uid()));
CREATE POLICY "Clients view own PT body metrics" ON public.pt_body_metrics FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- PRs
CREATE TABLE IF NOT EXISTS public.pt_prs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exercise text NOT NULL,
  weight_lbs numeric,
  reps integer,
  achieved_on date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Detroit')::date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pt_prs_user_idx ON public.pt_prs(user_id, achieved_on DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_prs TO authenticated;
GRANT ALL ON public.pt_prs TO service_role;
ALTER TABLE public.pt_prs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage PT prs" ON public.pt_prs FOR ALL TO authenticated
  USING (public.pt_is_staff_or_desk(auth.uid())) WITH CHECK (public.pt_is_staff_or_desk(auth.uid()));
CREATE POLICY "Clients view own PT prs" ON public.pt_prs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Session notes
CREATE TABLE IF NOT EXISTS public.pt_session_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.pt_appointments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  instructor_id uuid REFERENCES public.instructors(id) ON DELETE SET NULL,
  session_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Detroit')::date,
  subjective text,
  objective text,
  observations text,
  energy_level integer,
  mobility_issues text,
  modifications text,
  rpe numeric,
  homework text,
  next_focus text,
  is_draft boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pt_session_notes_user_idx ON public.pt_session_notes(user_id, session_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_session_notes TO authenticated;
GRANT ALL ON public.pt_session_notes TO service_role;
ALTER TABLE public.pt_session_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage PT session notes" ON public.pt_session_notes FOR ALL TO authenticated
  USING (public.pt_is_staff_or_desk(auth.uid())) WITH CHECK (public.pt_is_staff_or_desk(auth.uid()));

-- Exercise library
CREATE TABLE IF NOT EXISTS public.pt_exercise_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  muscle_group text,
  equipment text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_exercise_library TO authenticated;
GRANT ALL ON public.pt_exercise_library TO service_role;
ALTER TABLE public.pt_exercise_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage PT exercise library" ON public.pt_exercise_library FOR ALL TO authenticated
  USING (public.pt_is_staff_or_desk(auth.uid())) WITH CHECK (public.pt_is_staff_or_desk(auth.uid()));
CREATE POLICY "Authenticated read PT exercise library" ON public.pt_exercise_library FOR SELECT TO authenticated USING (true);

-- Programs
CREATE TABLE IF NOT EXISTS public.pt_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  instructor_id uuid REFERENCES public.instructors(id) ON DELETE SET NULL,
  name text NOT NULL,
  goal text,
  start_date date,
  length_weeks integer,
  sessions_per_week integer,
  next_reassessment date,
  focus_today text,
  is_template boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pt_programs_user_idx ON public.pt_programs(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_programs TO authenticated;
GRANT ALL ON public.pt_programs TO service_role;
ALTER TABLE public.pt_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage PT programs" ON public.pt_programs FOR ALL TO authenticated
  USING (public.pt_is_staff_or_desk(auth.uid())) WITH CHECK (public.pt_is_staff_or_desk(auth.uid()));
CREATE POLICY "Clients view own PT programs" ON public.pt_programs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.pt_program_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.pt_programs(id) ON DELETE CASCADE,
  label text NOT NULL,
  weekday smallint,
  focus text,
  day_type text NOT NULL DEFAULT 'strength',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pt_program_days_program_idx ON public.pt_program_days(program_id, display_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_program_days TO authenticated;
GRANT ALL ON public.pt_program_days TO service_role;
ALTER TABLE public.pt_program_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage PT program days" ON public.pt_program_days FOR ALL TO authenticated
  USING (public.pt_is_staff_or_desk(auth.uid())) WITH CHECK (public.pt_is_staff_or_desk(auth.uid()));
CREATE POLICY "Clients view own PT program days" ON public.pt_program_days FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pt_programs p WHERE p.id = program_id AND p.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.pt_program_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid NOT NULL REFERENCES public.pt_program_days(id) ON DELETE CASCADE,
  exercise text NOT NULL,
  sets integer,
  reps text,
  load text,
  tempo text,
  rest text,
  cues text,
  substitution text,
  superset_group text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pt_program_exercises_day_idx ON public.pt_program_exercises(day_id, display_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_program_exercises TO authenticated;
GRANT ALL ON public.pt_program_exercises TO service_role;
ALTER TABLE public.pt_program_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage PT program exercises" ON public.pt_program_exercises FOR ALL TO authenticated
  USING (public.pt_is_staff_or_desk(auth.uid())) WITH CHECK (public.pt_is_staff_or_desk(auth.uid()));
CREATE POLICY "Clients view own PT program exercises" ON public.pt_program_exercises FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pt_program_days d JOIN public.pt_programs p ON p.id = d.program_id
    WHERE d.id = day_id AND p.user_id = auth.uid()));

-- Activity log
CREATE TABLE IF NOT EXISTS public.pt_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  actor_id uuid,
  action text NOT NULL,
  detail text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pt_activity_log_user_idx ON public.pt_activity_log(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.pt_activity_log TO authenticated;
GRANT ALL ON public.pt_activity_log TO service_role;
ALTER TABLE public.pt_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read PT activity log" ON public.pt_activity_log FOR SELECT TO authenticated
  USING (public.pt_is_staff_or_desk(auth.uid()));
CREATE POLICY "Staff write PT activity log" ON public.pt_activity_log FOR INSERT TO authenticated
  WITH CHECK (public.pt_is_staff_or_desk(auth.uid()));

-- updated_at triggers
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pt_tasks','pt_client_profiles','pt_session_notes','pt_programs'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER %I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
  END LOOP;
END $$;