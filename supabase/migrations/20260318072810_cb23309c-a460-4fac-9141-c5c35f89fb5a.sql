
-- Create kids_care_hours table for admin-managed weekly scheduling
CREATE TABLE public.kids_care_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start DATE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (week_start, day_of_week)
);

-- RLS for kids_care_hours
ALTER TABLE public.kids_care_hours ENABLE ROW LEVEL SECURITY;

-- Staff can manage hours
CREATE POLICY "Staff can manage kids care hours"
  ON public.kids_care_hours
  FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager']::public.app_role[]));

-- Authenticated members can read hours
CREATE POLICY "Members can read kids care hours"
  ON public.kids_care_hours
  FOR SELECT
  TO authenticated
  USING (true);

-- Add new columns to kids_care_bookings
ALTER TABLE public.kids_care_bookings
  ADD COLUMN IF NOT EXISTS parent_confirmed_pickup BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS room TEXT;
