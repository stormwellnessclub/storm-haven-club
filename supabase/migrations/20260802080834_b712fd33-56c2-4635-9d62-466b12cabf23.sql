ALTER TABLE public.pt_trainer_availability
  ADD COLUMN IF NOT EXISTS effective_start date,
  ADD COLUMN IF NOT EXISTS effective_end date,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS label text;

ALTER TABLE public.pt_trainer_availability
  DROP CONSTRAINT IF EXISTS pt_trainer_availability_effective_range_check;
ALTER TABLE public.pt_trainer_availability
  ADD CONSTRAINT pt_trainer_availability_effective_range_check
  CHECK (effective_start IS NULL OR effective_end IS NULL OR effective_end >= effective_start);

ALTER TABLE public.pt_trainer_overrides
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_public_reason boolean NOT NULL DEFAULT false;

ALTER TABLE public.pt_trainer_overrides
  DROP CONSTRAINT IF EXISTS pt_trainer_overrides_end_date_check;
ALTER TABLE public.pt_trainer_overrides
  ADD CONSTRAINT pt_trainer_overrides_end_date_check
  CHECK (end_date IS NULL OR end_date >= date);

CREATE OR REPLACE FUNCTION public.get_public_trainer_availability(_instructor_id uuid, _from date, _to date)
RETURNS TABLE (
  day date,
  weekday smallint,
  start_time time,
  end_time time,
  label text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d::date AS day,
         a.weekday,
         a.start_time,
         a.end_time,
         a.label
  FROM generate_series(_from, _to, interval '1 day') AS d
  JOIN public.pt_trainer_availability a
    ON a.instructor_id = _instructor_id
   AND a.weekday = EXTRACT(dow FROM d)::smallint
   AND a.is_public = true
   AND (a.effective_start IS NULL OR d::date >= a.effective_start)
   AND (a.effective_end IS NULL OR d::date <= a.effective_end)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.pt_trainer_overrides o
    WHERE o.instructor_id = _instructor_id
      AND o.kind = 'block'
      AND d::date BETWEEN o.date AND COALESCE(o.end_date, o.date)
      AND (
        o.start_time IS NULL
        OR (a.start_time < o.end_time AND a.end_time > o.start_time)
      )
  )
  ORDER BY 1, 3;
$$;

REVOKE ALL ON FUNCTION public.get_public_trainer_availability(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_trainer_availability(uuid, date, date) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_trainer_blocks(_instructor_id uuid, _from date, _to date)
RETURNS TABLE (
  id uuid,
  start_date date,
  end_date date,
  start_time time,
  end_time time,
  reason text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id,
         o.date AS start_date,
         COALESCE(o.end_date, o.date) AS end_date,
         o.start_time,
         o.end_time,
         CASE WHEN o.is_public_reason THEN o.note ELSE NULL END AS reason
  FROM public.pt_trainer_overrides o
  WHERE o.instructor_id = _instructor_id
    AND o.kind = 'block'
    AND COALESCE(o.end_date, o.date) >= _from
    AND o.date <= _to
  ORDER BY o.date;
$$;

REVOKE ALL ON FUNCTION public.get_public_trainer_blocks(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_trainer_blocks(uuid, date, date) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_trainer(_instructor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appts int;
  v_notes int;
  v_sessions int;
  v_schedules int;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT count(*) INTO v_appts FROM public.pt_appointments WHERE instructor_id = _instructor_id;
  SELECT count(*) INTO v_notes FROM public.pt_session_notes WHERE instructor_id = _instructor_id;
  SELECT count(*) INTO v_sessions FROM public.class_sessions WHERE instructor_id = _instructor_id;
  SELECT count(*) INTO v_schedules FROM public.class_schedules WHERE instructor_id = _instructor_id;

  IF (v_appts + v_notes + v_sessions + v_schedules) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Cannot delete: trainer has %s PT sessions, %s notes, %s class sessions, %s schedules. Deactivate instead.',
        v_appts, v_notes, v_sessions, v_schedules)
    );
  END IF;

  DELETE FROM public.instructors WHERE id = _instructor_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_trainer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_trainer(uuid) TO authenticated;