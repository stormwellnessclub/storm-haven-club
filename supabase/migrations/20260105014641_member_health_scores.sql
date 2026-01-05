-- Member Health Scores Table
-- Stores calculated health scores for members over time periods

CREATE TABLE public.member_health_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  activity_score INTEGER NOT NULL CHECK (activity_score >= 0 AND activity_score <= 100),
  consistency_score INTEGER NOT NULL CHECK (consistency_score >= 0 AND consistency_score <= 100),
  goal_progress_score INTEGER NOT NULL CHECK (goal_progress_score >= 0 AND goal_progress_score <= 100),
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  UNIQUE(member_id, period_start, period_end)
);

-- Enable Row Level Security
ALTER TABLE public.member_health_scores ENABLE ROW LEVEL SECURITY;

-- Members can view their own health scores
CREATE POLICY "Members can view their own health scores"
ON public.member_health_scores
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = member_health_scores.member_id
    AND members.user_id = auth.uid()
  )
);

-- Staff can view all health scores
CREATE POLICY "Staff can view all health scores"
ON public.member_health_scores
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

-- Create indexes
CREATE INDEX idx_member_health_scores_member_id ON public.member_health_scores(member_id);
CREATE INDEX idx_member_health_scores_period ON public.member_health_scores(period_start, period_end);
CREATE INDEX idx_member_health_scores_calculated_at ON public.member_health_scores(calculated_at DESC);

-- Function: Calculate Health Score for a Member
-- Weights: Classes 30%, Spa 15%, Workouts 25%, Check-ins 10%, Goals 20%
CREATE OR REPLACE FUNCTION public.calculate_health_score(
  p_member_id UUID,
  p_period_start DATE DEFAULT NULL,
  p_period_end DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_start DATE;
  v_period_end DATE;
  v_classes_count INTEGER := 0;
  v_spa_count INTEGER := 0;
  v_workouts_count INTEGER := 0;
  v_checkins_count INTEGER := 0;
  v_goals_progress DECIMAL := 0;
  v_activity_score INTEGER;
  v_consistency_score INTEGER;
  v_goal_progress_score INTEGER;
  v_overall_score INTEGER;
  v_unique_days INTEGER;
  v_period_days INTEGER;
  v_result JSONB;
BEGIN
  -- Default to last 30 days if not specified
  IF p_period_end IS NULL THEN
    v_period_end := CURRENT_DATE;
  ELSE
    v_period_end := p_period_end;
  END IF;

  IF p_period_start IS NULL THEN
    v_period_start := v_period_end - INTERVAL '30 days';
  ELSE
    v_period_start := p_period_start;
  END IF;

  v_period_days := (v_period_end - v_period_start)::INTEGER;

  -- Count activities in period
  SELECT COUNT(*)
  INTO v_classes_count
  FROM public.member_activities
  WHERE member_id = p_member_id
    AND activity_type = 'class_attended'
    AND created_at::date >= v_period_start
    AND created_at::date <= v_period_end;

  SELECT COUNT(*)
  INTO v_spa_count
  FROM public.member_activities
  WHERE member_id = p_member_id
    AND activity_type = 'spa_service'
    AND created_at::date >= v_period_start
    AND created_at::date <= v_period_end;

  SELECT COUNT(*)
  INTO v_workouts_count
  FROM public.member_activities
  WHERE member_id = p_member_id
    AND activity_type = 'workout_logged'
    AND created_at::date >= v_period_start
    AND created_at::date <= v_period_end;

  SELECT COUNT(*)
  INTO v_checkins_count
  FROM public.check_ins
  WHERE member_id = p_member_id
    AND checked_in_at::date >= v_period_start
    AND checked_in_at::date <= v_period_end;

  -- Calculate unique active days
  SELECT COUNT(DISTINCT created_at::date)
  INTO v_unique_days
  FROM public.member_activities
  WHERE member_id = p_member_id
    AND created_at::date >= v_period_start
    AND created_at::date <= v_period_end;

  -- Calculate goal progress (average completion percentage of active goals)
  SELECT COALESCE(
    AVG(
      CASE 
        WHEN target_value > 0 THEN LEAST((current_value / target_value) * 100, 100)
        ELSE 0
      END
    ),
    0
  )
  INTO v_goals_progress
  FROM public.member_goals
  WHERE member_id = p_member_id
    AND status = 'active'
    AND start_date <= v_period_end;

  -- Calculate Activity Score (0-100)
  -- Based on total activity volume (normalized to 100)
  v_activity_score := LEAST(
    ((v_classes_count * 3 + v_spa_count * 2 + v_workouts_count * 2 + v_checkins_count * 1)::DECIMAL / GREATEST(v_period_days, 1)) * 10,
    100
  )::INTEGER;

  -- Calculate Consistency Score (0-100)
  -- Based on how many unique days member was active
  v_consistency_score := LEAST(
    (v_unique_days::DECIMAL / GREATEST(v_period_days, 1)) * 100,
    100
  )::INTEGER;

  -- Calculate Goal Progress Score (0-100)
  v_goal_progress_score := v_goals_progress::INTEGER;

  -- Calculate Overall Score with weights
  -- Classes: 30%, Spa: 15%, Workouts: 25%, Check-ins: 10%, Goals: 20%
  -- But we'll weight by activity components:
  v_overall_score := (
    (v_activity_score * 0.4) +
    (v_consistency_score * 0.3) +
    (v_goal_progress_score * 0.3)
  )::INTEGER;

  -- Store or update the score
  INSERT INTO public.member_health_scores (
    member_id,
    overall_score,
    activity_score,
    consistency_score,
    goal_progress_score,
    period_start,
    period_end
  )
  VALUES (
    p_member_id,
    v_overall_score,
    v_activity_score,
    v_consistency_score,
    v_goal_progress_score,
    v_period_start,
    v_period_end
  )
  ON CONFLICT (member_id, period_start, period_end)
  DO UPDATE SET
    overall_score = EXCLUDED.overall_score,
    activity_score = EXCLUDED.activity_score,
    consistency_score = EXCLUDED.consistency_score,
    goal_progress_score = EXCLUDED.goal_progress_score,
    calculated_at = now();

  -- Return result
  v_result := jsonb_build_object(
    'member_id', p_member_id,
    'period_start', v_period_start,
    'period_end', v_period_end,
    'overall_score', v_overall_score,
    'activity_score', v_activity_score,
    'consistency_score', v_consistency_score,
    'goal_progress_score', v_goal_progress_score,
    'activity_counts', jsonb_build_object(
      'classes', v_classes_count,
      'spa_services', v_spa_count,
      'workouts', v_workouts_count,
      'check_ins', v_checkins_count,
      'unique_days', v_unique_days
    )
  );

  RETURN v_result;
END;
$$;



