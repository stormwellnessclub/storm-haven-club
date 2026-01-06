-- 1. Create equipment table
CREATE TABLE IF NOT EXISTS public.equipment (
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

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active equipment"
  ON public.equipment FOR SELECT
  USING (is_active = true);

CREATE POLICY "Staff can manage equipment"
  ON public.equipment FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- 2. Create member_fitness_profiles table
CREATE TABLE IF NOT EXISTS public.member_fitness_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
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

ALTER TABLE public.member_fitness_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own fitness profile"
  ON public.member_fitness_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own fitness profile"
  ON public.member_fitness_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fitness profile"
  ON public.member_fitness_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all fitness profiles"
  ON public.member_fitness_profiles FOR SELECT
  USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- 3. Create application_status_history table
CREATE TABLE IF NOT EXISTS public.application_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.membership_applications(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.application_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all history"
  ON public.application_status_history FOR SELECT
  USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[]));

CREATE POLICY "Staff can create history"
  ON public.application_status_history FOR INSERT
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- 4. Add missing columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS guest_pass_agreement_signed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS single_class_pass_agreement_signed boolean DEFAULT false;

-- 5. Create atomic class booking RPC function
CREATE OR REPLACE FUNCTION public.create_atomic_class_booking(
  _session_id uuid,
  _user_id uuid,
  _payment_method text,
  _member_credit_id uuid DEFAULT NULL,
  _pass_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_booking_id uuid;
  v_session_capacity int;
  v_current_enrollment int;
BEGIN
  -- Get member_id for user
  SELECT id INTO v_member_id
  FROM members
  WHERE user_id = _user_id
  LIMIT 1;

  -- Check session capacity
  SELECT max_capacity, current_enrollment
  INTO v_session_capacity, v_current_enrollment
  FROM class_sessions
  WHERE id = _session_id
  FOR UPDATE;

  IF v_current_enrollment >= v_session_capacity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Class is full');
  END IF;

  -- Check for existing booking
  IF EXISTS (
    SELECT 1 FROM class_bookings
    WHERE session_id = _session_id
    AND user_id = _user_id
    AND status = 'confirmed'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already booked for this class');
  END IF;

  -- Deduct credit if using credits
  IF _member_credit_id IS NOT NULL THEN
    UPDATE member_credits
    SET credits_remaining = credits_remaining - 1
    WHERE id = _member_credit_id
    AND credits_remaining > 0;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'No available credits');
    END IF;
  END IF;

  -- Deduct pass if using pass
  IF _pass_id IS NOT NULL THEN
    UPDATE class_passes
    SET classes_remaining = classes_remaining - 1
    WHERE id = _pass_id
    AND classes_remaining > 0;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'No available classes on pass');
    END IF;
  END IF;

  -- Create booking
  INSERT INTO class_bookings (
    session_id,
    user_id,
    member_id,
    status,
    payment_method,
    member_credit_id,
    pass_id,
    credits_used
  ) VALUES (
    _session_id,
    _user_id,
    v_member_id,
    'confirmed',
    _payment_method,
    _member_credit_id,
    _pass_id,
    CASE WHEN _member_credit_id IS NOT NULL THEN 1 ELSE 0 END
  )
  RETURNING id INTO v_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;