-- Departments / profiles ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_schedule_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_key text NOT NULL UNIQUE,
  user_id uuid,
  placeholder_id uuid REFERENCES public.staff_placeholders(id) ON DELETE CASCADE,
  display_name text,
  departments text[] NOT NULL DEFAULT '{}',
  default_availability jsonb NOT NULL DEFAULT '{}'::jsonb,
  color text,
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_schedule_profiles TO authenticated;
GRANT ALL ON public.staff_schedule_profiles TO service_role;
ALTER TABLE public.staff_schedule_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scheduling staff view schedule profiles" ON public.staff_schedule_profiles
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));
CREATE POLICY "Managers manage schedule profiles" ON public.staff_schedule_profiles
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

CREATE TRIGGER trg_staff_schedule_profiles_updated_at
  BEFORE UPDATE ON public.staff_schedule_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Pay rates (manager-only) ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_pay_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_key text NOT NULL UNIQUE,
  hourly_rate numeric(10,2) NOT NULL DEFAULT 0,
  effective_from date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_pay_rates TO authenticated;
GRANT ALL ON public.staff_pay_rates TO service_role;
ALTER TABLE public.staff_pay_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers manage pay rates" ON public.staff_pay_rates
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

CREATE TRIGGER trg_staff_pay_rates_updated_at
  BEFORE UPDATE ON public.staff_pay_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Coverage rules -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_coverage_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL CHECK (end_time > start_time),
  min_staff integer NOT NULL DEFAULT 1 CHECK (min_staff >= 0),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_coverage_rules TO authenticated;
GRANT ALL ON public.staff_coverage_rules TO service_role;
ALTER TABLE public.staff_coverage_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scheduling staff view coverage rules" ON public.staff_coverage_rules
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));
CREATE POLICY "Managers manage coverage rules" ON public.staff_coverage_rules
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

CREATE TRIGGER trg_staff_coverage_rules_updated_at
  BEFORE UPDATE ON public.staff_coverage_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Additive columns -----------------------------------------------------------
ALTER TABLE public.staff_shifts ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.staff_shifts ADD COLUMN IF NOT EXISTS break_minutes integer NOT NULL DEFAULT 0;
ALTER TABLE public.staff_shifts ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE public.staff_shift_templates ADD COLUMN IF NOT EXISTS department text;

UPDATE public.staff_shifts SET department = position WHERE department IS NULL AND position IS NOT NULL;
UPDATE public.staff_shift_templates SET department = position WHERE department IS NULL AND position IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_shifts_department ON public.staff_shifts(department);

-- Functions ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_schedule_week(p_week_start date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.staff_shifts
     SET published_at = now()
   WHERE shift_date >= p_week_start
     AND shift_date < p_week_start + 7
     AND published_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.copy_schedule_week(p_from_week date, p_to_week date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_inserted integer := 0; v_skipped integer := 0; r record;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  FOR r IN
    SELECT * FROM public.staff_shifts
     WHERE shift_date >= p_from_week AND shift_date < p_from_week + 7
       AND status <> 'cancelled'
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.staff_shifts s
       WHERE s.shift_date = r.shift_date + (p_to_week - p_from_week)
         AND s.start_time = r.start_time
         AND COALESCE(s.user_id::text, s.person_ref) IS NOT DISTINCT FROM COALESCE(r.user_id::text, r.person_ref)
    ) THEN
      v_skipped := v_skipped + 1;
    ELSE
      INSERT INTO public.staff_shifts (user_id, person_ref, person_name, shift_date, start_time, end_time,
                                       position, department, break_minutes, notes, status, created_by)
      VALUES (r.user_id, r.person_ref, r.person_name, r.shift_date + (p_to_week - p_from_week), r.start_time, r.end_time,
              r.position, r.department, r.break_minutes, r.notes, 'scheduled', auth.uid());
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped);
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_labor_cost(p_start date, p_end date)
RETURNS TABLE(person_key text, person_name text, department text, hours numeric, hourly_rate numeric, cost numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT k.pkey,
         MAX(s.person_name),
         s.department,
         ROUND(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time))/3600 - COALESCE(s.break_minutes,0)/60.0)::numeric, 2),
         COALESCE(MAX(pr.hourly_rate), 0),
         ROUND((SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time))/3600 - COALESCE(s.break_minutes,0)/60.0) * COALESCE(MAX(pr.hourly_rate),0))::numeric, 2)
    FROM public.staff_shifts s
    CROSS JOIN LATERAL (SELECT COALESCE(s.user_id::text, 'ref:' || s.person_ref) AS pkey) k
    LEFT JOIN public.staff_pay_rates pr ON pr.person_key = k.pkey
   WHERE s.shift_date BETWEEN p_start AND p_end
     AND s.status = 'scheduled'
   GROUP BY k.pkey, s.department;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_schedule_week(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.copy_schedule_week(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_labor_cost(date, date) TO authenticated;