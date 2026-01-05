-- Workout Logs Table
-- Tracks member workout entries and exercise details

CREATE TABLE public.workout_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_type TEXT NOT NULL, -- 'strength', 'cardio', 'yoga', 'pilates', 'hiit', 'custom', etc.
  workout_name TEXT,
  duration_minutes INTEGER,
  calories_burned INTEGER,
  notes TEXT,
  exercises JSONB DEFAULT '[]'::JSONB, -- Array of exercises: [{name, sets, reps, weight, duration, rest}]
  performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

-- Members can view their own workout logs
CREATE POLICY "Members can view their own workout logs"
ON public.workout_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = workout_logs.member_id
    AND members.user_id = auth.uid()
  )
);

-- Members can insert their own workout logs
CREATE POLICY "Members can create their own workout logs"
ON public.workout_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = workout_logs.member_id
    AND members.user_id = auth.uid()
  )
  AND user_id = auth.uid()
);

-- Members can update their own workout logs
CREATE POLICY "Members can update their own workout logs"
ON public.workout_logs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = workout_logs.member_id
    AND members.user_id = auth.uid()
  )
);

-- Members can delete their own workout logs
CREATE POLICY "Members can delete their own workout logs"
ON public.workout_logs
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = workout_logs.member_id
    AND members.user_id = auth.uid()
  )
);

-- Staff can view all workout logs
CREATE POLICY "Staff can view all workout logs"
ON public.workout_logs
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

-- Create indexes
CREATE INDEX idx_workout_logs_member_id ON public.workout_logs(member_id);
CREATE INDEX idx_workout_logs_user_id ON public.workout_logs(user_id);
CREATE INDEX idx_workout_logs_performed_at ON public.workout_logs(performed_at DESC);
CREATE INDEX idx_workout_logs_workout_type ON public.workout_logs(workout_type);

-- Trigger for updated_at
CREATE TRIGGER update_workout_logs_updated_at
BEFORE UPDATE ON public.workout_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to log workout as activity
CREATE OR REPLACE FUNCTION public.log_workout_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.member_activities (
    member_id,
    activity_type,
    activity_data,
    points_earned
  )
  VALUES (
    NEW.member_id,
    'workout_logged',
    jsonb_build_object(
      'workout_log_id', NEW.id,
      'workout_type', NEW.workout_type,
      'workout_name', NEW.workout_name,
      'duration_minutes', NEW.duration_minutes,
      'calories_burned', NEW.calories_burned,
      'performed_at', NEW.performed_at
    ),
    5 -- Points for logging a workout
  );

  -- Update member streak
  PERFORM public.update_member_streak(NEW.member_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER log_workout_activity_trigger
AFTER INSERT ON public.workout_logs
FOR EACH ROW
EXECUTE FUNCTION public.log_workout_activity();



