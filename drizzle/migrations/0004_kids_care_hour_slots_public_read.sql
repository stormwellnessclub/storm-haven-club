DROP POLICY IF EXISTS "Public can view kids care hour slots" ON public.kids_care_hour_slots;
CREATE POLICY "Public can view kids care hour slots"
  ON public.kids_care_hour_slots FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT (id, slot_date, open_time, close_time, label) ON public.kids_care_hour_slots TO anon, authenticated;