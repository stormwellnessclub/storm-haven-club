-- Helper: is the writer a trusted (staff/service) writer?
CREATE OR REPLACE FUNCTION public.is_privileged_row_writer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NULL
      OR public.has_any_role(
           auth.uid(),
           ARRAY['super_admin','admin','manager','front_desk','spa_staff','childcare_staff','class_instructor']::app_role[]
         );
$$;

-- Helper: keys whose values changed between two row snapshots
CREATE OR REPLACE FUNCTION public.changed_columns(p_old jsonb, p_new jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(array_agg(k), ARRAY[]::text[])
  FROM (
    SELECT key AS k FROM jsonb_each(p_new)
    WHERE p_new -> key IS DISTINCT FROM p_old -> key
  ) s;
$$;

-- ============ class_passes ============
CREATE OR REPLACE FUNCTION public.guard_class_passes_member_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed text[];
  allowed text[] := ARRAY['classes_remaining','status','updated_at'];
  bad text;
BEGIN
  IF public.is_privileged_row_writer() THEN
    RETURN NEW;
  END IF;

  changed := public.changed_columns(to_jsonb(OLD), to_jsonb(NEW));

  FOREACH bad IN ARRAY changed LOOP
    IF NOT (bad = ANY(allowed)) THEN
      RAISE EXCEPTION 'Not allowed to change % on your class pass', bad
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  -- Sessions may never exceed what was purchased
  IF NEW.classes_remaining > COALESCE(OLD.classes_total, OLD.classes_remaining) THEN
    RAISE EXCEPTION 'Remaining sessions cannot exceed the purchased total'
      USING ERRCODE = '42501';
  END IF;

  -- Members may only move a pass between active / exhausted
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status::text NOT IN ('active','exhausted') THEN
    RAISE EXCEPTION 'Not allowed to set this pass status'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_class_passes_member_update ON public.class_passes;
CREATE TRIGGER trg_guard_class_passes_member_update
BEFORE UPDATE ON public.class_passes
FOR EACH ROW EXECUTE FUNCTION public.guard_class_passes_member_update();

-- ============ pt_appointments ============
CREATE OR REPLACE FUNCTION public.guard_pt_appointments_member_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed text[];
  allowed text[] := ARRAY['status','cancel_reason','cancelled_at','cancelled_by','updated_at'];
  bad text;
BEGIN
  IF public.is_privileged_row_writer() THEN
    RETURN NEW;
  END IF;

  -- Trainers keep their existing update rights
  IF NEW.instructor_id IS NOT NULL
     AND NEW.instructor_id = public.pt_my_instructor_id(auth.uid()) THEN
    RETURN NEW;
  END IF;

  changed := public.changed_columns(to_jsonb(OLD), to_jsonb(NEW));

  FOREACH bad IN ARRAY changed LOOP
    IF NOT (bad = ANY(allowed)) THEN
      RAISE EXCEPTION 'Not allowed to change % on your appointment', bad
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status::text NOT IN ('cancelled','late_cancel') THEN
    RAISE EXCEPTION 'You may only cancel your appointment'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_pt_appointments_member_update ON public.pt_appointments;
CREATE TRIGGER trg_guard_pt_appointments_member_update
BEFORE UPDATE ON public.pt_appointments
FOR EACH ROW EXECUTE FUNCTION public.guard_pt_appointments_member_update();

-- ============ spa_appointments ============
DROP POLICY IF EXISTS "Users can update their own spa appointments" ON public.spa_appointments;
CREATE POLICY "Users can update their own spa appointments"
ON public.spa_appointments
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR member_id IN (SELECT members.id FROM members WHERE members.user_id = auth.uid())
  OR has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk','spa_staff']::app_role[])
)
WITH CHECK (
  auth.uid() = user_id
  OR member_id IN (SELECT members.id FROM members WHERE members.user_id = auth.uid())
  OR has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','front_desk','spa_staff']::app_role[])
);

CREATE OR REPLACE FUNCTION public.guard_spa_appointments_member_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed text[];
  allowed text[] := ARRAY['status','cancelled_at','cancellation_reason','client_notes','updated_at'];
  bad text;
BEGIN
  IF public.is_privileged_row_writer() THEN
    RETURN NEW;
  END IF;

  changed := public.changed_columns(to_jsonb(OLD), to_jsonb(NEW));

  FOREACH bad IN ARRAY changed LOOP
    IF NOT (bad = ANY(allowed)) THEN
      RAISE EXCEPTION 'Not allowed to change % on your spa appointment', bad
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status::text <> 'cancelled' THEN
    RAISE EXCEPTION 'You may only cancel your spa appointment'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_spa_appointments_member_update ON public.spa_appointments;
CREATE TRIGGER trg_guard_spa_appointments_member_update
BEFORE UPDATE ON public.spa_appointments
FOR EACH ROW EXECUTE FUNCTION public.guard_spa_appointments_member_update();