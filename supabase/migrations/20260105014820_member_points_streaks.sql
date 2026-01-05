-- Add Points and Streaks to Members Table
-- Tracks member points and activity streaks

ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS total_points INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_streak_days INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS longest_streak_days INTEGER NOT NULL DEFAULT 0;

-- Create index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_members_total_points ON public.members(total_points DESC);

-- Function: Update Member Streak
-- Called when member has activity to update their streak
CREATE OR REPLACE FUNCTION public.update_member_streak(p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_activity_date DATE;
  v_yesterday DATE;
  v_today DATE;
  v_current_streak INTEGER;
BEGIN
  v_today := CURRENT_DATE;
  v_yesterday := v_today - INTERVAL '1 day';

  -- Get last activity date
  SELECT MAX(created_at::date)
  INTO v_last_activity_date
  FROM public.member_activities
  WHERE member_id = p_member_id;

  -- Get current streak
  SELECT COALESCE(current_streak_days, 0)
  INTO v_current_streak
  FROM public.members
  WHERE id = p_member_id;

  -- If activity today and last activity was yesterday, increment streak
  IF v_last_activity_date = v_today THEN
    IF v_last_activity_date = v_yesterday + INTERVAL '1 day' THEN
      -- Continuous streak
      v_current_streak := v_current_streak + 1;
    ELSIF v_last_activity_date = v_today AND v_current_streak = 0 THEN
      -- Starting new streak
      v_current_streak := 1;
    END IF;

    -- Update streak and longest streak
    UPDATE public.members
    SET 
      current_streak_days = v_current_streak,
      longest_streak_days = GREATEST(longest_streak_days, v_current_streak)
    WHERE id = p_member_id;
  END IF;

  -- If last activity was more than 1 day ago, reset streak
  IF v_last_activity_date < v_yesterday THEN
    UPDATE public.members
    SET current_streak_days = 0
    WHERE id = p_member_id;
  END IF;
END;
$$;

-- Trigger to update streak when activity is logged
CREATE OR REPLACE FUNCTION public.trigger_update_member_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.update_member_streak(NEW.member_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_streak_on_activity
AFTER INSERT ON public.member_activities
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_member_streak();



