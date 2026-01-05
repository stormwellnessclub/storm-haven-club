-- Goal Milestone Checking Function
-- Automatically detects and records milestone achievements when goal progress is updated

CREATE OR REPLACE FUNCTION public.check_goal_milestones(p_goal_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_goal RECORD;
  v_current_value DECIMAL(10,2);
  v_target_value DECIMAL(10,2);
  v_milestone RECORD;
  v_achieved_milestones JSONB := '[]'::JSONB;
  v_progress_percentage DECIMAL(10,2);
BEGIN
  -- Get goal details
  SELECT * INTO v_goal
  FROM public.member_goals
  WHERE id = p_goal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Goal not found');
  END IF;

  v_current_value := v_goal.current_value;
  v_target_value := v_goal.target_value;

  -- Calculate progress percentage
  IF v_target_value > 0 THEN
    v_progress_percentage := (v_current_value / v_target_value) * 100;
  ELSE
    v_progress_percentage := 0;
  END IF;

  -- Check all milestones for this goal
  FOR v_milestone IN
    SELECT * FROM public.goal_milestones
    WHERE goal_id = p_goal_id
      AND achieved_at IS NULL
    ORDER BY milestone_value ASC
  LOOP
    -- Check if milestone is achieved
    IF v_target_value > 0 AND v_current_value >= v_milestone.milestone_value THEN
      -- Mark milestone as achieved
      UPDATE public.goal_milestones
      SET achieved_at = now()
      WHERE id = v_milestone.id;

      -- Add to achieved list
      v_achieved_milestones := v_achieved_milestones || jsonb_build_object(
        'milestone_id', v_milestone.id,
        'milestone_label', v_milestone.milestone_label,
        'milestone_value', v_milestone.milestone_value
      );
    END IF;
  END LOOP;

  -- Check if goal itself is completed
  IF v_target_value > 0 AND v_current_value >= v_target_value AND v_goal.status = 'active' THEN
    UPDATE public.member_goals
    SET status = 'completed', updated_at = now()
    WHERE id = p_goal_id;
  END IF;

  RETURN jsonb_build_object(
    'goal_id', p_goal_id,
    'current_value', v_current_value,
    'target_value', v_target_value,
    'progress_percentage', ROUND(v_progress_percentage, 2),
    'achieved_milestones_count', jsonb_array_length(v_achieved_milestones),
    'achieved_milestones', v_achieved_milestones,
    'goal_completed', (v_target_value > 0 AND v_current_value >= v_target_value)
  );
END;
$$;

-- Trigger function to check milestones when goal current_value is updated
CREATE OR REPLACE FUNCTION public.trigger_check_goal_milestones()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only check if current_value actually changed
  IF OLD.current_value IS DISTINCT FROM NEW.current_value THEN
    PERFORM public.check_goal_milestones(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER check_goal_milestones_on_update
AFTER UPDATE ON public.member_goals
FOR EACH ROW
WHEN (OLD.current_value IS DISTINCT FROM NEW.current_value)
EXECUTE FUNCTION public.trigger_check_goal_milestones();

-- Trigger to check milestones when progress log is added
CREATE OR REPLACE FUNCTION public.trigger_check_milestones_on_progress_log()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update goal current_value and trigger milestone check
  UPDATE public.member_goals
  SET current_value = NEW.progress_value,
      updated_at = now()
  WHERE id = NEW.goal_id;
  
  -- Milestone check will be triggered by the update trigger above
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_milestones_on_progress_log
AFTER INSERT ON public.goal_progress_logs
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_milestones_on_progress_log();



