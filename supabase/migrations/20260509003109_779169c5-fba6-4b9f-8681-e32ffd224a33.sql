-- Validate kids care bookings against published hour slots
CREATE OR REPLACE FUNCTION public.validate_kids_care_booking_slot()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_match_count int;
BEGIN
  -- Only validate active bookings (allow cancellations/no_show updates without re-validation)
  IF NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, skip validation if date/time fields are unchanged
  IF TG_OP = 'UPDATE' THEN
    IF NEW.booking_date = OLD.booking_date
       AND NEW.start_time = OLD.start_time
       AND NEW.end_time = OLD.end_time THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT count(*) INTO v_match_count
  FROM public.kids_care_hour_slots s
  WHERE s.slot_date = NEW.booking_date
    AND NEW.start_time >= s.open_time
    AND NEW.end_time <= s.close_time;

  IF v_match_count = 0 THEN
    RAISE EXCEPTION 'This Kids Care time is no longer available. Please refresh and pick a current time.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_kids_care_booking_slot ON public.kids_care_bookings;
CREATE TRIGGER trg_validate_kids_care_booking_slot
  BEFORE INSERT OR UPDATE ON public.kids_care_bookings
  FOR EACH ROW EXECUTE FUNCTION public.validate_kids_care_booking_slot();

-- Enable realtime for kids_care_hour_slots so member apps auto-refresh
ALTER TABLE public.kids_care_hour_slots REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.kids_care_hour_slots;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;