CREATE TABLE public.workout_plan_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_date date NOT NULL,
  template_id uuid,
  label text,
  notes text,
  status text NOT NULL DEFAULT 'planned',
  workout_log_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workout_plan_entries_user_date ON public.workout_plan_entries(user_id, plan_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_plan_entries TO authenticated;
GRANT ALL ON public.workout_plan_entries TO service_role;
ALTER TABLE public.workout_plan_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own plan entries" ON public.workout_plan_entries FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.workout_sessions_in_progress (
  user_id uuid PRIMARY KEY,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_sessions_in_progress TO authenticated;
GRANT ALL ON public.workout_sessions_in_progress TO service_role;
ALTER TABLE public.workout_sessions_in_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own active session" ON public.workout_sessions_in_progress FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());