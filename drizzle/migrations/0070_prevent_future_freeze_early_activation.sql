CREATE OR REPLACE FUNCTION public.prevent_early_freeze_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_detroit_today date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Detroit')::date;
BEGIN
  IF NEW.status = 'active'
     AND OLD.status IS DISTINCT FROM 'active'
     AND COALESCE(NEW.actual_start_date, NEW.requested_start_date) > v_detroit_today THEN
    RAISE EXCEPTION 'FREEZE_START_NOT_REACHED: This freeze begins on %', COALESCE(NEW.actual_start_date, NEW.requested_start_date);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_early_freeze_activation ON public.member_freezes;
CREATE TRIGGER trg_prevent_early_freeze_activation
BEFORE UPDATE OF status ON public.member_freezes
FOR EACH ROW
EXECUTE FUNCTION public.prevent_early_freeze_activation();