-- Enum for shift status
CREATE TYPE public.staff_shift_status AS ENUM ('scheduled', 'pto', 'cancelled', 'swapped');

-- Enum for time off request status
CREATE TYPE public.staff_time_off_status AS ENUM ('pending', 'approved', 'denied');

-- ============================================================
-- staff_shift_templates: recurring weekly baseline
-- ============================================================
CREATE TABLE public.staff_shift_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  person_ref TEXT, -- email fallback for non-auth instructors/therapists
  person_name TEXT, -- display name for non-auth people
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  position TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from DATE,
  effective_to DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT staff_shift_templates_person_required CHECK (user_id IS NOT NULL OR person_ref IS NOT NULL),
  CONSTRAINT staff_shift_templates_time_order CHECK (end_time > start_time)
);

CREATE INDEX idx_staff_shift_templates_user ON public.staff_shift_templates(user_id);
CREATE INDEX idx_staff_shift_templates_person_ref ON public.staff_shift_templates(person_ref);
CREATE INDEX idx_staff_shift_templates_dow ON public.staff_shift_templates(day_of_week) WHERE is_active = true;

-- ============================================================
-- staff_shifts: specific dated shifts (overrides + ad-hoc)
-- ============================================================
CREATE TABLE public.staff_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  person_ref TEXT,
  person_name TEXT,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  position TEXT,
  notes TEXT,
  template_id UUID REFERENCES public.staff_shift_templates(id) ON DELETE SET NULL,
  status public.staff_shift_status NOT NULL DEFAULT 'scheduled',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT staff_shifts_person_required CHECK (user_id IS NOT NULL OR person_ref IS NOT NULL),
  CONSTRAINT staff_shifts_time_order CHECK (end_time > start_time)
);

CREATE INDEX idx_staff_shifts_user_date ON public.staff_shifts(user_id, shift_date);
CREATE INDEX idx_staff_shifts_person_ref_date ON public.staff_shifts(person_ref, shift_date);
CREATE INDEX idx_staff_shifts_date ON public.staff_shifts(shift_date);
CREATE INDEX idx_staff_shifts_template ON public.staff_shifts(template_id);

-- ============================================================
-- staff_time_off_requests
-- ============================================================
CREATE TABLE public.staff_time_off_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status public.staff_time_off_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT staff_time_off_date_order CHECK (end_date >= start_date)
);

CREATE INDEX idx_staff_time_off_user ON public.staff_time_off_requests(user_id);
CREATE INDEX idx_staff_time_off_status ON public.staff_time_off_requests(status);
CREATE INDEX idx_staff_time_off_dates ON public.staff_time_off_requests(start_date, end_date);

-- ============================================================
-- Updated_at triggers (reuse existing function)
-- ============================================================
CREATE TRIGGER update_staff_shift_templates_updated_at
  BEFORE UPDATE ON public.staff_shift_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_staff_shifts_updated_at
  BEFORE UPDATE ON public.staff_shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_staff_time_off_requests_updated_at
  BEFORE UPDATE ON public.staff_time_off_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.staff_shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_time_off_requests ENABLE ROW LEVEL SECURITY;

-- Helper: any staff role
CREATE OR REPLACE FUNCTION public.has_any_staff_role(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id
  );
$$;

-- Helper: schedule manager (manager/admin/super_admin)
CREATE OR REPLACE FUNCTION public.can_manage_staff_schedule(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin', 'manager')
  );
$$;

-- Templates: any staff can read, only managers can write
CREATE POLICY "Staff can view all shift templates"
  ON public.staff_shift_templates FOR SELECT
  USING (public.has_any_staff_role(auth.uid()));

CREATE POLICY "Managers can insert shift templates"
  ON public.staff_shift_templates FOR INSERT
  WITH CHECK (public.can_manage_staff_schedule(auth.uid()));

CREATE POLICY "Managers can update shift templates"
  ON public.staff_shift_templates FOR UPDATE
  USING (public.can_manage_staff_schedule(auth.uid()));

CREATE POLICY "Managers can delete shift templates"
  ON public.staff_shift_templates FOR DELETE
  USING (public.can_manage_staff_schedule(auth.uid()));

-- Shifts: any staff can read, only managers can write
CREATE POLICY "Staff can view all shifts"
  ON public.staff_shifts FOR SELECT
  USING (public.has_any_staff_role(auth.uid()));

CREATE POLICY "Managers can insert shifts"
  ON public.staff_shifts FOR INSERT
  WITH CHECK (public.can_manage_staff_schedule(auth.uid()));

CREATE POLICY "Managers can update shifts"
  ON public.staff_shifts FOR UPDATE
  USING (public.can_manage_staff_schedule(auth.uid()));

CREATE POLICY "Managers can delete shifts"
  ON public.staff_shifts FOR DELETE
  USING (public.can_manage_staff_schedule(auth.uid()));

-- Time off: staff create/view their own; managers see all + approve
CREATE POLICY "Staff view own time off, managers view all"
  ON public.staff_time_off_requests FOR SELECT
  USING (auth.uid() = user_id OR public.can_manage_staff_schedule(auth.uid()));

CREATE POLICY "Staff create own time off"
  ON public.staff_time_off_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.has_any_staff_role(auth.uid()));

CREATE POLICY "Staff update own pending; managers update any"
  ON public.staff_time_off_requests FOR UPDATE
  USING (
    (auth.uid() = user_id AND status = 'pending')
    OR public.can_manage_staff_schedule(auth.uid())
  );

CREATE POLICY "Staff delete own pending; managers delete any"
  ON public.staff_time_off_requests FOR DELETE
  USING (
    (auth.uid() = user_id AND status = 'pending')
    OR public.can_manage_staff_schedule(auth.uid())
  );

-- ============================================================
-- RPC: generate_shifts_from_templates(week_start date)
-- Materializes template rows into staff_shifts for the given week.
-- Skips dates where a shift already exists for the same user/template.
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_shifts_from_templates(week_start DATE)
RETURNS TABLE(inserted_count INTEGER, skipped_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INT := 0;
  v_skipped INT := 0;
  v_caller UUID := auth.uid();
BEGIN
  IF NOT public.can_manage_staff_schedule(v_caller) THEN
    RAISE EXCEPTION 'Not authorized to generate shifts';
  END IF;

  WITH days AS (
    SELECT
      week_start + i AS d,
      EXTRACT(DOW FROM (week_start + i))::SMALLINT AS dow
    FROM generate_series(0, 6) AS i
  ),
  candidates AS (
    SELECT
      t.id AS template_id,
      t.user_id,
      t.person_ref,
      t.person_name,
      d.d AS shift_date,
      t.start_time,
      t.end_time,
      t.position,
      t.notes
    FROM public.staff_shift_templates t
    JOIN days d ON d.dow = t.day_of_week
    WHERE t.is_active = true
      AND (t.effective_from IS NULL OR t.effective_from <= d.d)
      AND (t.effective_to IS NULL OR t.effective_to >= d.d)
  ),
  to_insert AS (
    SELECT c.*
    FROM candidates c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.staff_shifts s
      WHERE s.shift_date = c.shift_date
        AND s.template_id = c.template_id
    )
  ),
  ins AS (
    INSERT INTO public.staff_shifts (
      user_id, person_ref, person_name, shift_date,
      start_time, end_time, position, notes,
      template_id, status, created_by
    )
    SELECT
      user_id, person_ref, person_name, shift_date,
      start_time, end_time, position, notes,
      template_id, 'scheduled', v_caller
    FROM to_insert
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO v_inserted FROM ins;

  SELECT COUNT(*)::INT INTO v_skipped
  FROM (
    SELECT 1 FROM public.staff_shift_templates t
    JOIN (SELECT week_start + i AS d, EXTRACT(DOW FROM (week_start + i))::SMALLINT AS dow FROM generate_series(0,6) i) d
      ON d.dow = t.day_of_week
    WHERE t.is_active = true
      AND (t.effective_from IS NULL OR t.effective_from <= d.d)
      AND (t.effective_to IS NULL OR t.effective_to >= d.d)
      AND EXISTS (
        SELECT 1 FROM public.staff_shifts s
        WHERE s.shift_date = d.d AND s.template_id = t.id
      )
  ) sk;

  RETURN QUERY SELECT v_inserted, v_skipped;
END;
$$;