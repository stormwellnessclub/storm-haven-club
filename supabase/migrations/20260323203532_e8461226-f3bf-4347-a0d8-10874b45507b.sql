
-- 1. Bulk-hide future sessions from inactive schedules
UPDATE public.class_sessions cs
SET is_hidden = true
FROM public.class_schedules sched
WHERE cs.schedule_id = sched.id
  AND sched.is_active = false
  AND cs.session_date >= CURRENT_DATE
  AND cs.is_hidden = false;

-- 2. Trigger function: sync is_hidden when schedule is_active changes
CREATE OR REPLACE FUNCTION public.sync_schedule_active_to_sessions()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $func$
BEGIN
  IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
    UPDATE class_sessions
    SET is_hidden = NOT NEW.is_active,
        updated_at = now()
    WHERE schedule_id = NEW.id
      AND session_date >= CURRENT_DATE
      AND is_cancelled = false;
  END IF;
  RETURN NEW;
END;
$func$;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS trg_sync_schedule_active ON public.class_schedules;
CREATE TRIGGER trg_sync_schedule_active
  AFTER UPDATE OF is_active ON public.class_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_schedule_active_to_sessions();
