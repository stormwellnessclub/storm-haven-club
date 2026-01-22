-- =====================================================
-- Migration 3: kids_care_bookings table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.kids_care_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  child_name TEXT NOT NULL,
  child_age INTEGER NOT NULL,
  child_dob DATE,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  pass_id UUID REFERENCES public.class_passes(id) ON DELETE SET NULL,
  age_group TEXT,
  special_instructions TEXT,
  parent_notes TEXT,
  checked_in_at TIMESTAMPTZ,
  checked_out_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES auth.users(id),
  checked_out_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT
);

ALTER TABLE public.kids_care_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own kids care bookings"
ON public.kids_care_bookings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own kids care bookings"
ON public.kids_care_bookings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own kids care bookings"
ON public.kids_care_bookings FOR UPDATE
USING (auth.uid() = user_id AND status IN ('confirmed', 'pending'));

CREATE POLICY "Staff can view all kids care bookings"
ON public.kids_care_bookings FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'childcare_staff'::app_role, 'front_desk'::app_role]));

CREATE POLICY "Staff can manage all kids care bookings"
ON public.kids_care_bookings FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'childcare_staff'::app_role]));

CREATE TRIGGER update_kids_care_bookings_updated_at
  BEFORE UPDATE ON public.kids_care_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_kids_care_bookings_user_id ON public.kids_care_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_kids_care_bookings_member_id ON public.kids_care_bookings(member_id);
CREATE INDEX IF NOT EXISTS idx_kids_care_bookings_date_time ON public.kids_care_bookings(booking_date, start_time);
CREATE INDEX IF NOT EXISTS idx_kids_care_bookings_status ON public.kids_care_bookings(status);
CREATE INDEX IF NOT EXISTS idx_kids_care_bookings_pass_id ON public.kids_care_bookings(pass_id);
CREATE INDEX IF NOT EXISTS idx_kids_care_bookings_age_group ON public.kids_care_bookings(age_group);

COMMENT ON TABLE public.kids_care_bookings IS 'Stores kids care reservations with pass tracking and age groups.';