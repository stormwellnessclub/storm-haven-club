
-- Create kids_care_children table for per-child profiles
CREATE TABLE public.kids_care_children (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  allergies TEXT,
  medical_conditions TEXT,
  medications TEXT,
  special_instructions TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  relationship_to_child TEXT,
  authorized_pickup_persons TEXT,
  photo_release BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kids_care_children ENABLE ROW LEVEL SECURITY;

-- Users can CRUD their own children
CREATE POLICY "Users can view their own children"
  ON public.kids_care_children FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own children"
  ON public.kids_care_children FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own children"
  ON public.kids_care_children FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own children"
  ON public.kids_care_children FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Staff can read all children
CREATE POLICY "Staff can view all children"
  ON public.kids_care_children FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::app_role[]));

-- Auto-update updated_at
CREATE TRIGGER update_kids_care_children_updated_at
  BEFORE UPDATE ON public.kids_care_children
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
