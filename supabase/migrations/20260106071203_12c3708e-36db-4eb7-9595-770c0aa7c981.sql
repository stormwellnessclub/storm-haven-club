-- 1. Create member_goals table FIRST (referenced by other tables)
CREATE TABLE IF NOT EXISTS public.member_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  goal_type text NOT NULL,
  target_value numeric NOT NULL,
  current_value numeric DEFAULT 0,
  unit text,
  start_date date DEFAULT CURRENT_DATE,
  target_date date,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.member_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own goals"
  ON public.member_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own goals"
  ON public.member_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
  ON public.member_goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals"
  ON public.member_goals FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all goals"
  ON public.member_goals FOR SELECT
  USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- 2. Create goal_milestones table
CREATE TABLE IF NOT EXISTS public.goal_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.member_goals(id) ON DELETE CASCADE,
  milestone_value numeric NOT NULL,
  milestone_label text NOT NULL,
  achieved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.goal_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own goal milestones"
  ON public.goal_milestones FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.member_goals mg
    JOIN public.members m ON mg.member_id = m.id
    WHERE mg.id = goal_milestones.goal_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage their own goal milestones"
  ON public.goal_milestones FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.member_goals mg
    JOIN public.members m ON mg.member_id = m.id
    WHERE mg.id = goal_milestones.goal_id AND m.user_id = auth.uid()
  ));

-- 3. Create goal_progress_logs table
CREATE TABLE IF NOT EXISTS public.goal_progress_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.member_goals(id) ON DELETE CASCADE,
  progress_value numeric NOT NULL,
  logged_at timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.goal_progress_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own goal progress"
  ON public.goal_progress_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.member_goals mg
    JOIN public.members m ON mg.member_id = m.id
    WHERE mg.id = goal_progress_logs.goal_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage their own goal progress"
  ON public.goal_progress_logs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.member_goals mg
    JOIN public.members m ON mg.member_id = m.id
    WHERE mg.id = goal_progress_logs.goal_id AND m.user_id = auth.uid()
  ));

-- 4. Create habits table
CREATE TABLE IF NOT EXISTS public.habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  frequency text DEFAULT 'daily',
  target_count integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own habits"
  ON public.habits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own habits"
  ON public.habits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own habits"
  ON public.habits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own habits"
  ON public.habits FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Create habit_logs table
CREATE TABLE IF NOT EXISTS public.habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  logged_at date DEFAULT CURRENT_DATE,
  count integer DEFAULT 1,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own habit logs"
  ON public.habit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own habit logs"
  ON public.habit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own habit logs"
  ON public.habit_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own habit logs"
  ON public.habit_logs FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Create workout_logs table
CREATE TABLE IF NOT EXISTS public.workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  workout_type text NOT NULL,
  duration_minutes integer,
  calories_burned integer,
  notes text,
  logged_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own workout logs"
  ON public.workout_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own workout logs"
  ON public.workout_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workout logs"
  ON public.workout_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workout logs"
  ON public.workout_logs FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all workout logs"
  ON public.workout_logs FOR SELECT
  USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- 7. Create member_health_scores table
CREATE TABLE IF NOT EXISTS public.member_health_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  components jsonb DEFAULT '{}',
  calculated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.member_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own health scores"
  ON public.member_health_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own health scores"
  ON public.member_health_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can view all health scores"
  ON public.member_health_scores FOR SELECT
  USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- 8. Create member_achievements table
CREATE TABLE IF NOT EXISTS public.member_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  achievement_type text NOT NULL,
  achievement_name text NOT NULL,
  description text,
  earned_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.member_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own achievements"
  ON public.member_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own achievements"
  ON public.member_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can view all achievements"
  ON public.member_achievements FOR SELECT
  USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- 9. Create check_goal_milestones function
CREATE OR REPLACE FUNCTION public.check_goal_milestones(_goal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_goal RECORD;
BEGIN
  SELECT * INTO v_goal FROM member_goals WHERE id = _goal_id;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE goal_milestones SET achieved_at = now()
  WHERE goal_id = _goal_id AND achieved_at IS NULL AND milestone_value <= v_goal.current_value;
END;
$$;

-- 10. Create calculate_health_score function
CREATE OR REPLACE FUNCTION public.calculate_health_score(_member_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score integer := 50;
  v_workout_count integer;
BEGIN
  SELECT COUNT(*) INTO v_workout_count FROM workout_logs
  WHERE member_id = _member_id AND logged_at > now() - interval '30 days';
  v_score := v_score + LEAST(v_workout_count * 3, 30);
  RETURN GREATEST(0, LEAST(100, v_score));
END;
$$;

-- 11. Create check_and_award_achievements function
CREATE OR REPLACE FUNCTION public.check_and_award_achievements(_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_workout_count integer;
BEGIN
  SELECT user_id INTO v_user_id FROM members WHERE id = _member_id;
  IF v_user_id IS NULL THEN RETURN; END IF;
  SELECT COUNT(*) INTO v_workout_count FROM workout_logs WHERE member_id = _member_id;
  IF v_workout_count >= 1 AND NOT EXISTS (
    SELECT 1 FROM member_achievements WHERE member_id = _member_id AND achievement_type = 'first_workout'
  ) THEN
    INSERT INTO member_achievements (member_id, user_id, achievement_type, achievement_name, description)
    VALUES (_member_id, v_user_id, 'first_workout', 'First Steps', 'Completed your first workout');
  END IF;
END;
$$;