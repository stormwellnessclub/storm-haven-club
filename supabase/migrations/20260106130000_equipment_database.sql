-- Equipment Database Migration
-- Creates equipment table for managing gym equipment with images and Technogym integration

CREATE TABLE IF NOT EXISTS public.equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'cardio', 
    'strength', 
    'functional', 
    'free_weights', 
    'machines', 
    'accessories',
    'recovery'
  )),
  description TEXT,
  image_url TEXT,
  technogym_id TEXT,
  technogym_exercise_id TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

-- Anyone can view active equipment (for members to see available equipment)
CREATE POLICY "Anyone can view active equipment"
ON public.equipment
FOR SELECT
USING (is_active = true);

-- Staff can manage equipment
CREATE POLICY "Staff can manage equipment"
ON public.equipment
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('super_admin', 'admin', 'manager')
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_equipment_category ON public.equipment(category);
CREATE INDEX IF NOT EXISTS idx_equipment_active ON public.equipment(is_active);
CREATE INDEX IF NOT EXISTS idx_equipment_technogym_id ON public.equipment(technogym_id);

-- Create trigger for updated_at
CREATE TRIGGER update_equipment_updated_at
BEFORE UPDATE ON public.equipment
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update member_fitness_profiles to use equipment IDs instead of text
-- First, check if we need to migrate existing data
DO $$
BEGIN
  -- If available_equipment is currently TEXT[], we'll keep it for now
  -- and add a new column for equipment IDs
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'member_fitness_profiles' 
    AND column_name = 'equipment_ids'
  ) THEN
    ALTER TABLE public.member_fitness_profiles 
    ADD COLUMN equipment_ids UUID[] DEFAULT '{}'::UUID[];
  END IF;
END $$;

