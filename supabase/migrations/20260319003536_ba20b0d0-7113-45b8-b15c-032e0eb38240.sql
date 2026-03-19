
CREATE TABLE public.kids_care_hour_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_date DATE NOT NULL,
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  label TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_kids_care_hour_slots_date ON public.kids_care_hour_slots(slot_date);

ALTER TABLE public.kids_care_hour_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view kids care hour slots"
  ON public.kids_care_hour_slots FOR SELECT TO authenticated USING (true);

CREATE POLICY "Public can view kids care hour slots"
  ON public.kids_care_hour_slots FOR SELECT TO anon USING (true);

CREATE POLICY "Staff can insert kids care hour slots"
  ON public.kids_care_hour_slots FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'childcare_staff']::app_role[]));

CREATE POLICY "Staff can update kids care hour slots"
  ON public.kids_care_hour_slots FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'childcare_staff']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'childcare_staff']::app_role[]));

CREATE POLICY "Staff can delete kids care hour slots"
  ON public.kids_care_hour_slots FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin', 'manager', 'childcare_staff']::app_role[]));
