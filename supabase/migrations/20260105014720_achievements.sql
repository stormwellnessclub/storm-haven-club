-- Achievements System
-- Defines achievements and tracks member achievements

CREATE TABLE public.achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon_url TEXT,
  criteria JSONB NOT NULL, -- {type: 'classes_attended', count: 10, period: 'all_time' | 'month' | 'week'}
  points_reward INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.member_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(member_id, achievement_id)
);

-- Enable Row Level Security
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_achievements ENABLE ROW LEVEL SECURITY;

-- Achievements are public (can be viewed by anyone)
CREATE POLICY "Anyone can view achievements"
ON public.achievements
FOR SELECT
USING (is_active = true);

-- Members can view their own achievements
CREATE POLICY "Members can view their own achievements"
ON public.member_achievements
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = member_achievements.member_id
    AND members.user_id = auth.uid()
  )
);

-- Staff can view all member achievements
CREATE POLICY "Staff can view all member achievements"
ON public.member_achievements
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

-- Create indexes
CREATE INDEX idx_achievements_active ON public.achievements(is_active);
CREATE INDEX idx_member_achievements_member_id ON public.member_achievements(member_id);
CREATE INDEX idx_member_achievements_achievement_id ON public.member_achievements(achievement_id);
CREATE INDEX idx_member_achievements_earned_at ON public.member_achievements(earned_at DESC);

-- Function: Check and Award Achievements
-- Checks if member qualifies for any achievements and awards them
CREATE OR REPLACE FUNCTION public.check_and_award_achievements(p_member_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_achievement RECORD;
  v_count INTEGER;
  v_awarded JSONB := '[]'::JSONB;
  v_criteria_type TEXT;
  v_criteria_count INTEGER;
  v_criteria_period TEXT;
  v_period_start DATE;
  v_earned_count INTEGER;
BEGIN
  -- Loop through all active achievements
  FOR v_achievement IN 
    SELECT * FROM public.achievements WHERE is_active = true
  LOOP
    -- Check if member already has this achievement
    SELECT COUNT(*) INTO v_earned_count
    FROM public.member_achievements
    WHERE member_id = p_member_id
      AND achievement_id = v_achievement.id;

    IF v_earned_count > 0 THEN
      CONTINUE; -- Skip if already earned
    END IF;

    -- Extract criteria
    v_criteria_type := v_achievement.criteria->>'type';
    v_criteria_count := (v_achievement.criteria->>'count')::INTEGER;
    v_criteria_period := COALESCE(v_achievement.criteria->>'period', 'all_time');

    -- Calculate period start date
    IF v_criteria_period = 'week' THEN
      v_period_start := CURRENT_DATE - INTERVAL '7 days';
    ELSIF v_criteria_period = 'month' THEN
      v_period_start := CURRENT_DATE - INTERVAL '30 days';
    ELSE
      v_period_start := '1900-01-01'::DATE; -- All time
    END IF;

    -- Check criteria based on type
    v_count := 0;

    CASE v_criteria_type
      WHEN 'classes_attended' THEN
        SELECT COUNT(*) INTO v_count
        FROM public.member_activities
        WHERE member_id = p_member_id
          AND activity_type = 'class_attended'
          AND created_at::date >= v_period_start;

      WHEN 'spa_services' THEN
        SELECT COUNT(*) INTO v_count
        FROM public.member_activities
        WHERE member_id = p_member_id
          AND activity_type = 'spa_service'
          AND created_at::date >= v_period_start;

      WHEN 'workouts_logged' THEN
        SELECT COUNT(*) INTO v_count
        FROM public.member_activities
        WHERE member_id = p_member_id
          AND activity_type = 'workout_logged'
          AND created_at::date >= v_period_start;

      WHEN 'check_ins' THEN
        SELECT COUNT(*) INTO v_count
        FROM public.check_ins
        WHERE member_id = p_member_id
          AND checked_in_at::date >= v_period_start;

      WHEN 'streak_days' THEN
        -- Get current streak from members table
        SELECT COALESCE(current_streak_days, 0) INTO v_count
        FROM public.members
        WHERE id = p_member_id;

      WHEN 'total_points' THEN
        -- Get total points from members table
        SELECT COALESCE(total_points, 0) INTO v_count
        FROM public.members
        WHERE id = p_member_id;

      ELSE
        v_count := 0;
    END CASE;

    -- If criteria met, award achievement
    IF v_count >= v_criteria_count THEN
      -- Insert achievement
      INSERT INTO public.member_achievements (member_id, achievement_id)
      VALUES (p_member_id, v_achievement.id)
      ON CONFLICT (member_id, achievement_id) DO NOTHING;

      -- Add points to member
      IF v_achievement.points_reward > 0 THEN
        UPDATE public.members
        SET total_points = COALESCE(total_points, 0) + v_achievement.points_reward
        WHERE id = p_member_id;
      END IF;

      -- Add to awarded list
      v_awarded := v_awarded || jsonb_build_object(
        'achievement_id', v_achievement.id,
        'name', v_achievement.name,
        'points_reward', v_achievement.points_reward
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'member_id', p_member_id,
    'awarded_count', jsonb_array_length(v_awarded),
    'awarded', v_awarded
  );
END;
$$;

-- Insert some default achievements
INSERT INTO public.achievements (name, description, criteria, points_reward) VALUES
  ('First Class', 'Attend your first class', '{"type": "classes_attended", "count": 1, "period": "all_time"}'::JSONB, 50),
  ('Class Regular', 'Attend 10 classes', '{"type": "classes_attended", "count": 10, "period": "all_time"}'::JSONB, 200),
  ('Class Master', 'Attend 50 classes', '{"type": "classes_attended", "count": 50, "period": "all_time"}'::JSONB, 500),
  ('Week Warrior', 'Attend 5 classes in a week', '{"type": "classes_attended", "count": 5, "period": "week"}'::JSONB, 100),
  ('Consistency King', 'Maintain a 7-day streak', '{"type": "streak_days", "count": 7, "period": "all_time"}'::JSONB, 150),
  ('Month Master', 'Maintain a 30-day streak', '{"type": "streak_days", "count": 30, "period": "all_time"}'::JSONB, 500),
  ('Points Collector', 'Earn 1000 points', '{"type": "total_points", "count": 1000, "period": "all_time"}'::JSONB, 200),
  ('Spa Enthusiast', 'Book 5 spa services', '{"type": "spa_services", "count": 5, "period": "all_time"}'::JSONB, 150),
  ('Workout Warrior', 'Log 20 workouts', '{"type": "workouts_logged", "count": 20, "period": "all_time"}'::JSONB, 300),
  ('Frequent Visitor', 'Check in 30 times', '{"type": "check_ins", "count": 30, "period": "all_time"}'::JSONB, 200);



