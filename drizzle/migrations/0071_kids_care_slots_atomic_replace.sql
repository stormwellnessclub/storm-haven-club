CREATE UNIQUE INDEX IF NOT EXISTS kids_care_hour_slots_unique_time ON public.kids_care_hour_slots (slot_date, open_time, close_time);

CREATE OR REPLACE FUNCTION public.replace_kids_care_hour_slots(p_date date, p_slots jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','childcare_staff']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM public.kids_care_hour_slots WHERE slot_date = p_date;
  INSERT INTO public.kids_care_hour_slots (slot_date, open_time, close_time, label, notes, staff_name, created_by, updated_at)
  SELECT p_date, (s->>'open_time')::time, (s->>'close_time')::time,
         NULLIF(s->>'label',''), NULLIF(s->>'notes',''), NULLIF(s->>'staff_name',''), auth.uid(), now()
  FROM jsonb_array_elements(COALESCE(p_slots,'[]'::jsonb)) s
  ON CONFLICT (slot_date, open_time, close_time) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.copy_kids_care_hour_slots(p_source date, p_targets date[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t date;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','childcare_staff']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kids_care_hour_slots WHERE slot_date = p_source) THEN
    RAISE EXCEPTION 'No slots to copy from source date';
  END IF;
  FOREACH t IN ARRAY p_targets LOOP
    CONTINUE WHEN t = p_source;
    DELETE FROM public.kids_care_hour_slots WHERE slot_date = t;
    INSERT INTO public.kids_care_hour_slots (slot_date, open_time, close_time, label, notes, staff_name, created_by, updated_at)
    SELECT t, open_time, close_time, label, notes, staff_name, auth.uid(), now()
    FROM public.kids_care_hour_slots WHERE slot_date = p_source
    ON CONFLICT (slot_date, open_time, close_time) DO NOTHING;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.replace_kids_care_hour_slots(date, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.copy_kids_care_hour_slots(date, date[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_kids_care_hour_slots(date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.copy_kids_care_hour_slots(date, date[]) TO authenticated;