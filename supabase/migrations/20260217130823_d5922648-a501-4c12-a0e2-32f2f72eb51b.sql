
-- Create amenity type enum
CREATE TYPE public.amenity_type AS ENUM (
  'sauna', 'salt_room', 'cold_plunge', 'steam_room', 'zero_body_cryo', 'red_light_therapy'
);

-- Create amenity_usage_logs table
CREATE TABLE public.amenity_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amenity_type public.amenity_type NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes INTEGER,
  notes TEXT,
  check_in_id UUID REFERENCES public.check_ins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_amenity_usage_member ON public.amenity_usage_logs(member_id);
CREATE INDEX idx_amenity_usage_type ON public.amenity_usage_logs(amenity_type);
CREATE INDEX idx_amenity_usage_used_at ON public.amenity_usage_logs(used_at);
CREATE INDEX idx_amenity_usage_user ON public.amenity_usage_logs(user_id);

-- Enable RLS
ALTER TABLE public.amenity_usage_logs ENABLE ROW LEVEL SECURITY;

-- Members can view their own logs
CREATE POLICY "Members can view own amenity usage"
  ON public.amenity_usage_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Members can insert their own logs
CREATE POLICY "Members can log own amenity usage"
  ON public.amenity_usage_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Members can delete their own logs
CREATE POLICY "Members can delete own amenity usage"
  ON public.amenity_usage_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Staff can view all amenity usage
CREATE POLICY "Staff can view all amenity usage"
  ON public.amenity_usage_logs FOR SELECT
  USING (
    has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[])
  );

-- Trigger to log amenity usage as member activity (3 points)
CREATE OR REPLACE FUNCTION public.log_amenity_usage_activity()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.member_activities (
    member_id, activity_type, activity_data, points_earned
  ) VALUES (
    NEW.member_id,
    'spa_service',
    jsonb_build_object(
      'amenity_log_id', NEW.id,
      'amenity_type', NEW.amenity_type::text,
      'duration_minutes', NEW.duration_minutes,
      'used_at', NEW.used_at,
      'source', 'amenity_log'
    ),
    3
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_amenity_usage_activity
  AFTER INSERT ON public.amenity_usage_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.log_amenity_usage_activity();
