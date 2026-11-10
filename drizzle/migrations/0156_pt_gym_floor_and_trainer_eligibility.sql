CREATE OR REPLACE FUNCTION public.pt_check_appointment_conflict(p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_instructor_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid, p_exclude_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  -- PT happens on the gym floor: room occupancy never blocks PT.
  RETURN jsonb_build_object(
    'has_conflict', (jsonb_array_length(v_trainer) > 0 OR jsonb_array_length(v_room) > 0),
    'trainer_conflicts', v_trainer,
    'room_conflicts', v_room
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.pt_check_appointment_conflict(p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_instructor_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid, p_exclude_id uuid DEFAULT NULL::uuid, p_format pt_format DEFAULT NULL::pt_format)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_trainer jsonb := '[]'::jsonb;
  v_room jsonb := '[]'::jsonb;
  v_group_count integer := 0;
  v_capacity integer := 1;
  v_is_group boolean := (p_format = 'semi_private'::pt_format);
  v_group_full boolean := false;
BEGIN
  IF NOT public.pt_is_staff_or_desk(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_is_group THEN
    SELECT GREATEST(COALESCE(MAX(st.capacity), 1), 1) INTO v_capacity
    FROM pt_session_types st WHERE st.format = p_format AND st.is_active = true;
    SELECT count(*) INTO v_group_count
    FROM pt_appointments a
    WHERE a.format = p_format AND a.starts_at = p_starts_at AND a.ends_at = p_ends_at
      AND a.instructor_id IS NOT DISTINCT FROM p_instructor_id
      AND a.status NOT IN ('cancelled','late_cancel','no_show')
      AND coalesce(a.is_waitlist, false) = false
      AND (p_exclude_id IS NULL OR a.id <> p_exclude_id);
    v_group_full := v_group_count >= v_capacity;
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
      AND a.starts_at < p_ends_at AND a.ends_at > p_starts_at
      AND NOT (v_is_group AND NOT v_group_full AND a.format = p_format
               AND a.starts_at = p_starts_at AND a.ends_at = p_ends_at);
  END IF;
  -- PT happens on the gym floor: room occupancy never blocks PT.
  RETURN jsonb_build_object(
    'has_conflict', (jsonb_array_length(v_trainer) > 0 OR jsonb_array_length(v_room) > 0),
    'trainer_conflicts', v_trainer,
    'room_conflicts', v_room,
    'is_group', COALESCE(v_is_group, false),
    'group_count', v_group_count,
    'group_capacity', v_capacity,
    'group_full', v_group_full
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.pt_slot_hard_conflict(p jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_array_length(coalesce(p->'trainer_conflicts','[]'::jsonb)) > 0
      OR jsonb_array_length(coalesce(p->'client_conflicts','[]'::jsonb)) > 0
      OR coalesce((p->>'group_full')::boolean, false)
$$;

ALTER TABLE public.pt_session_types ADD COLUMN IF NOT EXISTS request_only boolean NOT NULL DEFAULT false;

INSERT INTO public.pt_session_types (name, code, description, format, duration_minutes, capacity, requires_package, is_active, display_order, request_only)
SELECT 'Mat Pilates 1:1', 'mat_pilates', 'Private mat Pilates session. Request an appointment.', 'one_on_one', 60, 1, false, true, 6, true
WHERE NOT EXISTS (SELECT 1 FROM public.pt_session_types WHERE code = 'mat_pilates');
UPDATE public.pt_session_types SET request_only = true WHERE code IN ('reformer','mat_pilates');

CREATE TABLE public.pt_trainer_services (
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  session_type_id uuid NOT NULL REFERENCES public.pt_session_types(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instructor_id, session_type_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_trainer_services TO authenticated;
GRANT ALL ON public.pt_trainer_services TO service_role;
ALTER TABLE public.pt_trainer_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read PT trainer services" ON public.pt_trainer_services FOR SELECT TO authenticated
  USING (public.pt_is_staff_or_desk(auth.uid()));
CREATE POLICY "Managers edit PT trainer services" ON public.pt_trainer_services FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager']::app_role[]));

INSERT INTO public.pt_trainer_services (instructor_id, session_type_id)
SELECT i.id, st.id FROM public.instructors i CROSS JOIN public.pt_session_types st
 WHERE ((i.first_name = 'Storm' AND i.last_name = 'S') OR (i.first_name = 'Klaudia' AND i.last_name = 'Selim'))
   AND st.code IN ('pt','semi_private','assessment','consultation')
UNION ALL
SELECT i.id, st.id FROM public.instructors i CROSS JOIN public.pt_session_types st
 WHERE i.first_name = 'Bea' AND i.last_name = 'M' AND st.code IN ('reformer','mat_pilates')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_pt_eligible_trainers(p_session_code text DEFAULT NULL, p_format pt_format DEFAULT NULL)
RETURNS TABLE(id uuid, first_name text, last_name text, session_codes text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.first_name, i.last_name, array_agg(DISTINCT st.code ORDER BY st.code)
    FROM instructors i
    JOIN pt_trainer_services ts ON ts.instructor_id = i.id
    JOIN pt_session_types st ON st.id = ts.session_type_id AND st.is_active
   WHERE i.is_active AND public.pt_is_staff_or_desk(auth.uid())
     AND (p_session_code IS NULL OR st.code = p_session_code)
     AND (p_format IS NULL OR st.format = p_format)
   GROUP BY i.id, i.first_name, i.last_name
   ORDER BY i.first_name
$$;
REVOKE EXECUTE ON FUNCTION public.get_pt_eligible_trainers(text, pt_format) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pt_eligible_trainers(text, pt_format) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pt_enforce_trainer_eligibility()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.instructor_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.instructor_id IS NOT DISTINCT FROM OLD.instructor_id
     AND NEW.format IS NOT DISTINCT FROM OLD.format THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM pt_trainer_services ts JOIN pt_session_types st ON st.id = ts.session_type_id
                  WHERE ts.instructor_id = NEW.instructor_id AND st.format = NEW.format) THEN
    RAISE EXCEPTION 'TRAINER_NOT_ELIGIBLE: this trainer is not set up for this type of session';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pt_enforce_trainer_eligibility ON public.pt_appointments;
CREATE TRIGGER pt_enforce_trainer_eligibility BEFORE INSERT OR UPDATE OF instructor_id, format ON public.pt_appointments
  FOR EACH ROW EXECUTE FUNCTION public.pt_enforce_trainer_eligibility();