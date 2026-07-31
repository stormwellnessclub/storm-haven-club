
CREATE OR REPLACE FUNCTION public.pt_check_appointment_conflict(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_instructor_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL,
  p_exclude_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trainer jsonb := '[]'::jsonb;
  v_room jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.pt_is_staff_or_desk(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_instructor_id IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'user_id', a.user_id)), '[]'::jsonb)
      INTO v_trainer
    FROM pt_appointments a
    WHERE a.instructor_id = p_instructor_id
      AND a.status NOT IN ('cancelled','late_cancel','no_show')
      AND coalesce(a.is_waitlist, false) = false
      AND (p_exclude_id IS NULL OR a.id <> p_exclude_id)
      AND a.starts_at < p_ends_at
      AND a.ends_at > p_starts_at;
  END IF;

  IF p_location_id IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'user_id', a.user_id)), '[]'::jsonb)
      INTO v_room
    FROM pt_appointments a
    WHERE a.location_id = p_location_id
      AND a.status NOT IN ('cancelled','late_cancel','no_show')
      AND coalesce(a.is_waitlist, false) = false
      AND (p_exclude_id IS NULL OR a.id <> p_exclude_id)
      AND a.starts_at < p_ends_at
      AND a.ends_at > p_starts_at;
  END IF;

  RETURN jsonb_build_object(
    'has_conflict', (jsonb_array_length(v_trainer) > 0 OR jsonb_array_length(v_room) > 0),
    'trainer_conflicts', v_trainer,
    'room_conflicts', v_room
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pt_reschedule_appointment(
  p_appointment_id uuid,
  p_starts_at timestamptz DEFAULT NULL,
  p_duration_minutes integer DEFAULT NULL,
  p_instructor_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL,
  p_force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt pt_appointments%ROWTYPE;
  v_start timestamptz;
  v_dur integer;
  v_end timestamptz;
  v_instructor uuid;
  v_location uuid;
  v_conflict jsonb;
BEGIN
  IF NOT public.pt_is_staff_or_desk(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_appt FROM pt_appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  v_start := coalesce(p_starts_at, v_appt.starts_at);
  v_dur := coalesce(p_duration_minutes, v_appt.duration_minutes);
  v_end := v_start + make_interval(mins => v_dur);
  v_instructor := coalesce(p_instructor_id, v_appt.instructor_id);
  v_location := coalesce(p_location_id, v_appt.location_id);

  v_conflict := public.pt_check_appointment_conflict(
    v_start, v_end, v_instructor, v_location, p_appointment_id);

  IF (v_conflict->>'has_conflict')::boolean AND NOT p_force THEN
    RETURN jsonb_build_object('success', false, 'conflict', v_conflict);
  END IF;

  UPDATE pt_appointments
     SET starts_at = v_start,
         ends_at = v_end,
         duration_minutes = v_dur,
         instructor_id = v_instructor,
         location_id = v_location,
         updated_at = now()
   WHERE id = p_appointment_id;

  RETURN jsonb_build_object('success', true, 'conflict', v_conflict);
END;
$$;

CREATE TABLE IF NOT EXISTS public.pt_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  scope text NOT NULL DEFAULT 'clients',
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_saved_views TO authenticated;
GRANT ALL ON public.pt_saved_views TO service_role;

ALTER TABLE public.pt_saved_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view pt saved views" ON public.pt_saved_views;
CREATE POLICY "view pt saved views"
  ON public.pt_saved_views FOR SELECT
  TO authenticated
  USING (public.pt_is_staff_or_desk(auth.uid()) AND (owner_id = auth.uid() OR is_shared));

DROP POLICY IF EXISTS "insert own pt saved views" ON public.pt_saved_views;
CREATE POLICY "insert own pt saved views"
  ON public.pt_saved_views FOR INSERT
  TO authenticated
  WITH CHECK (public.pt_is_staff_or_desk(auth.uid()) AND owner_id = auth.uid());

DROP POLICY IF EXISTS "update own pt saved views" ON public.pt_saved_views;
CREATE POLICY "update own pt saved views"
  ON public.pt_saved_views FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "delete own pt saved views" ON public.pt_saved_views;
CREATE POLICY "delete own pt saved views"
  ON public.pt_saved_views FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS pt_saved_views_scope_idx ON public.pt_saved_views (scope, owner_id);
