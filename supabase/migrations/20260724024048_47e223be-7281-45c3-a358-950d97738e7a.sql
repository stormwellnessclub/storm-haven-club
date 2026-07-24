-- 1) One-time cleanup: remove orphaned future sessions that have no confirmed bookings
DELETE FROM public.class_sessions s
WHERE s.schedule_id IS NULL
  AND s.session_date >= CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1 FROM public.class_bookings b
    WHERE b.session_id = s.id AND b.status = 'confirmed'
  );

-- 2) Change FK behavior so future schedule deletes cascade instead of orphaning sessions
ALTER TABLE public.class_sessions
  DROP CONSTRAINT IF EXISTS class_sessions_schedule_id_fkey;

ALTER TABLE public.class_sessions
  ADD CONSTRAINT class_sessions_schedule_id_fkey
  FOREIGN KEY (schedule_id) REFERENCES public.class_schedules(id) ON DELETE CASCADE;