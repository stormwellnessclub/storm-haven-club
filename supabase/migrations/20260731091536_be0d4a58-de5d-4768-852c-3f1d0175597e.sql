
ALTER TABLE public.pt_appointments
  ADD COLUMN IF NOT EXISTS live_state jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.pt_session_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.pt_appointments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  exercise_id uuid,
  program_exercise_id uuid,
  exercise text NOT NULL,
  planned_sets integer,
  planned_reps text,
  planned_load text,
  tempo text,
  rest text,
  cues text,
  media_url text,
  modification text,
  notes text,
  display_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  skip_reason text,
  substituted_from text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pt_session_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_exercise_id uuid NOT NULL REFERENCES public.pt_session_exercises(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.pt_appointments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  set_number integer NOT NULL,
  weight_lbs numeric,
  reps integer,
  duration_seconds integer,
  distance numeric,
  distance_unit text,
  rpe numeric,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  notes text,
  pain_flag boolean NOT NULL DEFAULT false,
  is_pr boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_exercise_id, set_number)
);

CREATE INDEX IF NOT EXISTS idx_pt_session_exercises_appt ON public.pt_session_exercises(appointment_id, display_order);
CREATE INDEX IF NOT EXISTS idx_pt_session_sets_appt ON public.pt_session_sets(appointment_id);
CREATE INDEX IF NOT EXISTS idx_pt_session_sets_ex ON public.pt_session_sets(session_exercise_id, set_number);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_session_exercises TO authenticated;
GRANT ALL ON public.pt_session_exercises TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_session_sets TO authenticated;
GRANT ALL ON public.pt_session_sets TO service_role;

ALTER TABLE public.pt_session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_session_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage PT session exercises" ON public.pt_session_exercises
  FOR ALL TO authenticated USING (public.pt_is_staff_or_desk(auth.uid())) WITH CHECK (public.pt_is_staff_or_desk(auth.uid()));
CREATE POLICY "Clients view own PT session exercises" ON public.pt_session_exercises
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Staff manage PT session sets" ON public.pt_session_sets
  FOR ALL TO authenticated USING (public.pt_is_staff_or_desk(auth.uid())) WITH CHECK (public.pt_is_staff_or_desk(auth.uid()));
CREATE POLICY "Clients view own PT session sets" ON public.pt_session_sets
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER trg_pt_session_exercises_updated BEFORE UPDATE ON public.pt_session_exercises
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pt_session_sets_updated BEFORE UPDATE ON public.pt_session_sets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
