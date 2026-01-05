-- Habit Streak Update Function
-- Automatically calculates and updates streaks when habit logs are created or updated

CREATE OR REPLACE FUNCTION public.update_habit_streak(p_habit_id UUID, p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_logged_date DATE;
  v_yesterday DATE;
  v_today DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_logged_dates DATE[];
  v_continuous_count INTEGER := 0;
  v_check_date DATE;
BEGIN
  v_today := CURRENT_DATE;
  v_yesterday := v_today - INTERVAL '1 day';

  -- Get all logged dates for this habit/member, ordered by date descending
  SELECT ARRAY_AGG(logged_date ORDER BY logged_date DESC)
  INTO v_logged_dates
  FROM public.habit_logs
  WHERE habit_id = p_habit_id
    AND member_id = p_member_id;

  -- If no logs, reset streak
  IF v_logged_dates IS NULL OR array_length(v_logged_dates, 1) = 0 THEN
    INSERT INTO public.habit_streaks (habit_id, member_id, current_streak, longest_streak, last_logged_date)
    VALUES (p_habit_id, p_member_id, 0, 0, NULL)
    ON CONFLICT (habit_id, member_id)
    DO UPDATE SET
      current_streak = 0,
      last_logged_date = NULL,
      updated_at = now();
    RETURN;
  END IF;

  -- Get last logged date
  v_last_logged_date := v_logged_dates[1];

  -- Calculate current streak by counting consecutive days from today backwards
  v_check_date := v_today;
  v_current_streak := 0;

  -- Check if today or yesterday was logged
  IF v_check_date = ANY(v_logged_dates) OR (v_check_date - INTERVAL '1 day') = ANY(v_logged_dates) THEN
    -- Start counting from the most recent logged date
    v_check_date := v_last_logged_date;
    
    -- Count consecutive days
    WHILE v_check_date = ANY(v_logged_dates) LOOP
      v_current_streak := v_current_streak + 1;
      v_check_date := v_check_date - INTERVAL '1 day';
    END LOOP;
  END IF;

  -- Get existing longest streak
  SELECT COALESCE(longest_streak, 0)
  INTO v_longest_streak
  FROM public.habit_streaks
  WHERE habit_id = p_habit_id
    AND member_id = p_member_id;

  -- Update or insert streak
  INSERT INTO public.habit_streaks (habit_id, member_id, current_streak, longest_streak, last_logged_date)
  VALUES (
    p_habit_id,
    p_member_id,
    v_current_streak,
    GREATEST(v_current_streak, COALESCE(v_longest_streak, 0)),
    v_last_logged_date
  )
  ON CONFLICT (habit_id, member_id)
  DO UPDATE SET
    current_streak = EXCLUDED.current_streak,
    longest_streak = GREATEST(habit_streaks.longest_streak, EXCLUDED.current_streak),
    last_logged_date = EXCLUDED.last_logged_date,
    updated_at = now();
END;
$$;

-- Trigger function to automatically update streak when habit log is inserted
CREATE OR REPLACE FUNCTION public.trigger_update_habit_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.update_habit_streak(NEW.habit_id, NEW.member_id);
  RETURN NEW;
END;
$$;

-- Trigger function to update streak when habit log is deleted
CREATE OR REPLACE FUNCTION public.trigger_update_habit_streak_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.update_habit_streak(OLD.habit_id, OLD.member_id);
  RETURN OLD;
END;
$$;

-- Create triggers
CREATE TRIGGER update_habit_streak_on_log_insert
AFTER INSERT ON public.habit_logs
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_habit_streak();

CREATE TRIGGER update_habit_streak_on_log_update
AFTER UPDATE ON public.habit_logs
FOR EACH ROW
WHEN (OLD.logged_date IS DISTINCT FROM NEW.logged_date OR OLD.logged_value IS DISTINCT FROM NEW.logged_value)
EXECUTE FUNCTION public.trigger_update_habit_streak();

CREATE TRIGGER update_habit_streak_on_log_delete
AFTER DELETE ON public.habit_logs
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_habit_streak_on_delete();



