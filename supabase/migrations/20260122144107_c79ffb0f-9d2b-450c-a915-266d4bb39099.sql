-- Create member_activities table if not exists
CREATE TABLE IF NOT EXISTS public.member_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  activity_data JSONB NOT NULL DEFAULT '{}',
  points_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.member_activities ENABLE ROW LEVEL SECURITY;

-- RLS policies (skip if exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'member_activities' AND policyname = 'Members can view their own activities') THEN
    CREATE POLICY "Members can view their own activities"
    ON public.member_activities FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.members
        WHERE members.id = member_activities.member_id
        AND members.user_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'member_activities' AND policyname = 'Staff can view all activities') THEN
    CREATE POLICY "Staff can view all activities"
    ON public.member_activities FOR SELECT
    USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'member_activities' AND policyname = 'System can insert activities') THEN
    CREATE POLICY "System can insert activities"
    ON public.member_activities FOR INSERT
    WITH CHECK (true);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_member_activities_member_id ON public.member_activities(member_id);
CREATE INDEX IF NOT EXISTS idx_member_activities_activity_type ON public.member_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_member_activities_created_at ON public.member_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_activities_member_created ON public.member_activities(member_id, created_at DESC);