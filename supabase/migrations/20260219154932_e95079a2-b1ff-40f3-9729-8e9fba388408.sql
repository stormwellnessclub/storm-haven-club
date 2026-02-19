
-- Create non_member_profiles table for non-member users (class pass holders, etc.)
CREATE TABLE public.non_member_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  stripe_customer_id TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.non_member_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own non_member_profile"
  ON public.non_member_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own non_member_profile"
  ON public.non_member_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own non_member_profile"
  ON public.non_member_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Staff can view all non_member_profiles
CREATE POLICY "Staff can view all non_member_profiles"
  ON public.non_member_profiles FOR SELECT
  USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'front_desk']::app_role[]));

-- Staff can update all non_member_profiles
CREATE POLICY "Staff can update all non_member_profiles"
  ON public.non_member_profiles FOR UPDATE
  USING (has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- Trigger for updated_at
CREATE TRIGGER update_non_member_profiles_updated_at
  BEFORE UPDATE ON public.non_member_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create update_updated_at_column if it doesn't exist (it likely does already)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
