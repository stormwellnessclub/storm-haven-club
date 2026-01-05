-- Habits System
-- Tracks member habits with logging and streak functionality

-- Habits Table (habit definitions)
CREATE TABLE public.habits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE, -- NULL for system habits
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'fitness', 'nutrition', 'wellness', 'recovery'
  frequency TEXT NOT NULL DEFAULT 'daily', -- 'daily', 'weekly', 'custom'
  target_value INTEGER NOT NULL DEFAULT 1, -- e.g., 8 glasses water, 30 min workout
  unit TEXT, -- 'glasses', 'minutes', 'times', 'miles', etc.
  color TEXT, -- UI color hex code
  icon TEXT, -- Icon identifier
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habit Logs Table (habit entries/logs)
CREATE TABLE public.habit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  logged_value INTEGER NOT NULL DEFAULT 1,
  logged_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(habit_id, logged_date, member_id)
);

-- Habit Streaks Table (tracking streaks per habit)
CREATE TABLE public.habit_streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_logged_date DATE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(habit_id, member_id)
);

-- Enable Row Level Security
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_streaks ENABLE ROW LEVEL SECURITY;

-- Habits Policies
-- Members can view their own habits and system habits
CREATE POLICY "Members can view their own habits"
ON public.habits
FOR SELECT
USING (
  member_id IS NULL -- System habits
  OR EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = habits.member_id
    AND members.user_id = auth.uid()
  )
);

-- Members can create their own habits
CREATE POLICY "Members can create their own habits"
ON public.habits
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = habits.member_id
    AND members.user_id = auth.uid()
  )
);

-- Members can update their own habits
CREATE POLICY "Members can update their own habits"
ON public.habits
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = habits.member_id
    AND members.user_id = auth.uid()
  )
);

-- Members can delete their own habits
CREATE POLICY "Members can delete their own habits"
ON public.habits
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = habits.member_id
    AND members.user_id = auth.uid()
  )
);

-- Habit Logs Policies
-- Members can view their own habit logs
CREATE POLICY "Members can view their own habit logs"
ON public.habit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = habit_logs.member_id
    AND members.user_id = auth.uid()
  )
);

-- Members can create their own habit logs
CREATE POLICY "Members can create their own habit logs"
ON public.habit_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = habit_logs.member_id
    AND members.user_id = auth.uid()
  )
);

-- Members can update their own habit logs
CREATE POLICY "Members can update their own habit logs"
ON public.habit_logs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = habit_logs.member_id
    AND members.user_id = auth.uid()
  )
);

-- Members can delete their own habit logs
CREATE POLICY "Members can delete their own habit logs"
ON public.habit_logs
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = habit_logs.member_id
    AND members.user_id = auth.uid()
  )
);

-- Habit Streaks Policies
-- Members can view their own habit streaks
CREATE POLICY "Members can view their own habit streaks"
ON public.habit_streaks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = habit_streaks.member_id
    AND members.user_id = auth.uid()
  )
);

-- Staff can view all habits, logs, and streaks
CREATE POLICY "Staff can view all habits"
ON public.habits
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

CREATE POLICY "Staff can view all habit logs"
ON public.habit_logs
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

CREATE POLICY "Staff can view all habit streaks"
ON public.habit_streaks
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

-- Create indexes
CREATE INDEX idx_habits_member_id ON public.habits(member_id);
CREATE INDEX idx_habits_is_active ON public.habits(is_active);
CREATE INDEX idx_habit_logs_habit_id ON public.habit_logs(habit_id);
CREATE INDEX idx_habit_logs_member_id ON public.habit_logs(member_id);
CREATE INDEX idx_habit_logs_logged_date ON public.habit_logs(logged_date DESC);
CREATE INDEX idx_habit_streaks_habit_id ON public.habit_streaks(habit_id);
CREATE INDEX idx_habit_streaks_member_id ON public.habit_streaks(member_id);

-- Trigger for updated_at on habits
CREATE TRIGGER update_habits_updated_at
BEFORE UPDATE ON public.habits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on habit_streaks
CREATE TRIGGER update_habit_streaks_updated_at
BEFORE UPDATE ON public.habit_streaks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();



