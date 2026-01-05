-- Goals System
-- Tracks member goals with progress and milestones

-- Member Goals Table
CREATE TABLE public.member_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL, -- 'weight_loss', 'strength', 'endurance', 'flexibility', 'custom'
  title TEXT NOT NULL,
  description TEXT,
  target_value DECIMAL(10,2),
  current_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit TEXT, -- 'lbs', 'minutes', 'reps', 'miles', '%', etc.
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'paused', 'cancelled'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Goal Milestones Table
CREATE TABLE public.goal_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID NOT NULL REFERENCES public.member_goals(id) ON DELETE CASCADE,
  milestone_value DECIMAL(10,2) NOT NULL,
  milestone_label TEXT,
  achieved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Goal Progress Logs Table
CREATE TABLE public.goal_progress_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID NOT NULL REFERENCES public.member_goals(id) ON DELETE CASCADE,
  progress_value DECIMAL(10,2) NOT NULL,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable Row Level Security
ALTER TABLE public.member_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_progress_logs ENABLE ROW LEVEL SECURITY;

-- Member Goals Policies
-- Members can view their own goals
CREATE POLICY "Members can view their own goals"
ON public.member_goals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = member_goals.member_id
    AND members.user_id = auth.uid()
  )
);

-- Members can create their own goals
CREATE POLICY "Members can create their own goals"
ON public.member_goals
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = member_goals.member_id
    AND members.user_id = auth.uid()
  )
);

-- Members can update their own goals
CREATE POLICY "Members can update their own goals"
ON public.member_goals
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = member_goals.member_id
    AND members.user_id = auth.uid()
  )
);

-- Members can delete their own goals
CREATE POLICY "Members can delete their own goals"
ON public.member_goals
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = member_goals.member_id
    AND members.user_id = auth.uid()
  )
);

-- Goal Milestones Policies
-- Members can view milestones for their goals
CREATE POLICY "Members can view milestones for their goals"
ON public.goal_milestones
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.member_goals
    JOIN public.members ON members.id = member_goals.member_id
    WHERE member_goals.id = goal_milestones.goal_id
    AND members.user_id = auth.uid()
  )
);

-- Goal Progress Logs Policies
-- Members can view progress logs for their goals
CREATE POLICY "Members can view progress logs for their goals"
ON public.goal_progress_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.member_goals
    JOIN public.members ON members.id = member_goals.member_id
    WHERE member_goals.id = goal_progress_logs.goal_id
    AND members.user_id = auth.uid()
  )
);

-- Members can create progress logs for their goals
CREATE POLICY "Members can create progress logs for their goals"
ON public.goal_progress_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.member_goals
    JOIN public.members ON members.id = member_goals.member_id
    WHERE member_goals.id = goal_progress_logs.goal_id
    AND members.user_id = auth.uid()
  )
);

-- Staff can view all goals, milestones, and logs
CREATE POLICY "Staff can view all goals"
ON public.member_goals
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

CREATE POLICY "Staff can view all goal milestones"
ON public.goal_milestones
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

CREATE POLICY "Staff can view all goal progress logs"
ON public.goal_progress_logs
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

-- Create indexes
CREATE INDEX idx_member_goals_member_id ON public.member_goals(member_id);
CREATE INDEX idx_member_goals_status ON public.member_goals(status);
CREATE INDEX idx_member_goals_goal_type ON public.member_goals(goal_type);
CREATE INDEX idx_goal_milestones_goal_id ON public.goal_milestones(goal_id);
CREATE INDEX idx_goal_progress_logs_goal_id ON public.goal_progress_logs(goal_id);
CREATE INDEX idx_goal_progress_logs_logged_at ON public.goal_progress_logs(logged_at DESC);

-- Trigger for updated_at on member_goals
CREATE TRIGGER update_member_goals_updated_at
BEFORE UPDATE ON public.member_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();



