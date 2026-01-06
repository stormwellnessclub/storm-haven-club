-- Add missing database tables and columns

-- Create member_fitness_profiles table
CREATE TABLE IF NOT EXISTS member_fitness_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fitness_level text CHECK (fitness_level IN ('beginner', 'intermediate', 'advanced')),
  primary_goal text,
  secondary_goals text[] DEFAULT '{}',
  available_equipment text[] DEFAULT '{}',
  equipment_ids uuid[] DEFAULT '{}',
  available_time_minutes integer DEFAULT 30,
  workout_preferences jsonb DEFAULT '{}',
  injuries_limitations text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(member_id),
  UNIQUE(user_id)
);

-- Create equipment table
CREATE TABLE IF NOT EXISTS equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('cardio', 'strength', 'functional', 'free_weights', 'machines', 'accessories', 'recovery')),
  description text,
  image_url text,
  technogym_id text,
  technogym_exercise_id text,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create application_status_history table
CREATE TABLE IF NOT EXISTS application_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES membership_applications(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Add missing columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS guest_pass_agreement_signed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS single_class_pass_agreement_signed boolean DEFAULT false;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_member_fitness_profiles_member_id ON member_fitness_profiles(member_id);
CREATE INDEX IF NOT EXISTS idx_member_fitness_profiles_user_id ON member_fitness_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);
CREATE INDEX IF NOT EXISTS idx_equipment_is_active ON equipment(is_active);
CREATE INDEX IF NOT EXISTS idx_application_status_history_application_id ON application_status_history(application_id);

-- Enable RLS
ALTER TABLE member_fitness_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for member_fitness_profiles
CREATE POLICY "Members can view their own fitness profile"
  ON member_fitness_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Members can insert their own fitness profile"
  ON member_fitness_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can update their own fitness profile"
  ON member_fitness_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all fitness profiles"
  ON member_fitness_profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin', 'staff')
  ));

-- RLS Policies for equipment
CREATE POLICY "Authenticated users can view active equipment"
  ON equipment FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);

CREATE POLICY "Staff can manage equipment"
  ON equipment FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin', 'staff')
  ));

-- RLS Policies for application_status_history
CREATE POLICY "Users can view their own application history"
  ON application_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM membership_applications
      WHERE membership_applications.id = application_status_history.application_id
      AND membership_applications.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Staff can view all application history"
  ON application_status_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin', 'staff')
  ));

CREATE POLICY "Staff can insert application history"
  ON application_status_history FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin', 'staff')
  ));

