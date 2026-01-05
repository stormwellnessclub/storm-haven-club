-- AI-Generated Workouts Table
-- Stores AI-generated personalized workouts for members

CREATE TABLE public.ai_workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  workout_name TEXT NOT NULL,
  workout_type TEXT NOT NULL, -- 'strength', 'cardio', 'yoga', 'pilates', 'hiit', 'custom', etc.
  duration_minutes INTEGER,
  difficulty TEXT, -- 'beginner', 'intermediate', 'advanced'
  exercises JSONB NOT NULL DEFAULT '[]'::JSONB, -- Array of exercise details: [{name, sets, reps, weight, duration, rest, notes}]
  ai_reasoning TEXT, -- Why this workout was generated (explanation from AI)
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ai_workouts ENABLE ROW LEVEL SECURITY;

-- Members can view their own AI workouts
CREATE POLICY "Members can view their own AI workouts"
ON public.ai_workouts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = ai_workouts.member_id
    AND members.user_id = auth.uid()
  )
);

-- Members can insert their own AI workouts (typically done by system via edge function)
CREATE POLICY "Members can create their own AI workouts"
ON public.ai_workouts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = ai_workouts.member_id
    AND members.user_id = auth.uid()
  )
);

-- Members can update their own AI workouts (mark as completed, etc.)
CREATE POLICY "Members can update their own AI workouts"
ON public.ai_workouts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = ai_workouts.member_id
    AND members.user_id = auth.uid()
  )
);

-- Members can delete their own AI workouts
CREATE POLICY "Members can delete their own AI workouts"
ON public.ai_workouts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.id = ai_workouts.member_id
    AND members.user_id = auth.uid()
  )
);

-- Staff can view all AI workouts
CREATE POLICY "Staff can view all AI workouts"
ON public.ai_workouts
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

-- Create indexes
CREATE INDEX idx_ai_workouts_member_id ON public.ai_workouts(member_id);
CREATE INDEX idx_ai_workouts_generated_at ON public.ai_workouts(generated_at DESC);
CREATE INDEX idx_ai_workouts_is_completed ON public.ai_workouts(is_completed);
CREATE INDEX idx_ai_workouts_workout_type ON public.ai_workouts(workout_type);



