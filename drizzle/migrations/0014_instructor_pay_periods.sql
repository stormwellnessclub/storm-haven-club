CREATE TABLE public.instructor_pay_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  rate_per_class NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ,
  paid_by UUID,
  payment_note TEXT,
  auto_roll BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instructor_id, start_date, end_date)
);

CREATE TABLE public.instructor_pay_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.instructor_pay_periods(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.class_sessions(id) ON DELETE SET NULL,
  item_date DATE NOT NULL,
  start_time TIME,
  description TEXT NOT NULL,
  attendance_count INTEGER NOT NULL DEFAULT 0,
  rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_manual BOOLEAN NOT NULL DEFAULT false,
  is_paid_class BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  adjusted_by UUID,
  adjusted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ipp_instructor ON public.instructor_pay_periods(instructor_id, start_date DESC);
CREATE INDEX idx_ipi_period ON public.instructor_pay_items(period_id, item_date);
CREATE UNIQUE INDEX idx_ipi_period_session ON public.instructor_pay_items(period_id, session_id) WHERE session_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_pay_periods TO authenticated;
GRANT ALL ON public.instructor_pay_periods TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_pay_items TO authenticated;
GRANT ALL ON public.instructor_pay_items TO service_role;

ALTER TABLE public.instructor_pay_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_pay_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors read own pay periods" ON public.instructor_pay_periods
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.instructors i WHERE i.id = instructor_id AND i.user_id = auth.uid()));

CREATE POLICY "Managers manage pay periods" ON public.instructor_pay_periods
FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

CREATE POLICY "Instructors read own pay items" ON public.instructor_pay_items
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.instructors i WHERE i.id = instructor_id AND i.user_id = auth.uid()));

CREATE POLICY "Managers manage pay items" ON public.instructor_pay_items
FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

CREATE OR REPLACE FUNCTION public.refresh_instructor_pay_period(_period_id UUID)
RETURNS public.instructor_pay_periods
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.instructor_pay_periods;
BEGIN
  SELECT * INTO p FROM public.instructor_pay_periods WHERE id = _period_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Pay period not found'; END IF;
  IF p.status = 'paid' THEN RETURN p; END IF;

  DELETE FROM public.instructor_pay_items
   WHERE period_id = p.id AND is_manual = false;

  INSERT INTO public.instructor_pay_items
    (period_id, instructor_id, session_id, item_date, start_time, description,
     attendance_count, rate, amount, is_paid_class)
  SELECT p.id, p.instructor_id, s.id, s.session_date, s.start_time,
         COALESCE(ct.name, 'Class'),
         att.cnt,
         CASE WHEN att.cnt > 0 THEN p.rate_per_class ELSE 0 END,
         CASE WHEN att.cnt > 0 THEN p.rate_per_class ELSE 0 END,
         att.cnt > 0
    FROM public.class_sessions s
    LEFT JOIN public.class_types ct ON ct.id = s.class_type_id
    CROSS JOIN LATERAL (
      SELECT COUNT(*)::int AS cnt
        FROM public.class_bookings b
       WHERE b.session_id = s.id
         AND b.status <> 'cancelled'
         AND b.checked_in_at IS NOT NULL
    ) att
   WHERE s.instructor_id = p.instructor_id
     AND s.is_cancelled = false
     AND s.session_date BETWEEN p.start_date AND p.end_date;

  UPDATE public.instructor_pay_periods
     SET total_amount = COALESCE((SELECT SUM(amount) FROM public.instructor_pay_items WHERE period_id = p.id), 0),
         updated_at = now()
   WHERE id = p.id
  RETURNING * INTO p;

  RETURN p;
END;
$$;

CREATE OR REPLACE FUNCTION public.roll_instructor_pay_periods()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  n INTEGER := 0;
  today DATE := (now() AT TIME ZONE 'America/Detroit')::date;
BEGIN
  FOR p IN
    SELECT * FROM public.instructor_pay_periods
     WHERE status = 'open' AND end_date < today
  LOOP
    PERFORM public.refresh_instructor_pay_period(p.id);
    UPDATE public.instructor_pay_periods SET status = 'due', updated_at = now() WHERE id = p.id;
    n := n + 1;

    IF p.auto_roll THEN
      INSERT INTO public.instructor_pay_periods
        (instructor_id, start_date, end_date, status, rate_per_class, auto_roll)
      VALUES (p.instructor_id, p.end_date + 1, p.end_date + 14, 'open', p.rate_per_class, true)
      ON CONFLICT (instructor_id, start_date, end_date) DO NOTHING;
    END IF;
  END LOOP;

  FOR p IN SELECT * FROM public.instructor_pay_periods WHERE status = 'open' AND start_date <= today
  LOOP
    PERFORM public.refresh_instructor_pay_period(p.id);
  END LOOP;

  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mark_pay_period_paid(_period_id UUID, _note TEXT DEFAULT NULL)
RETURNS public.instructor_pay_periods
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p public.instructor_pay_periods;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  PERFORM public.refresh_instructor_pay_period(_period_id);
  UPDATE public.instructor_pay_periods
     SET status = 'paid', paid_at = now(), paid_by = auth.uid(),
         payment_note = COALESCE(_note, payment_note), updated_at = now()
   WHERE id = _period_id
  RETURNING * INTO p;
  RETURN p;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unmark_pay_period_paid(_period_id UUID)
RETURNS public.instructor_pay_periods
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p public.instructor_pay_periods;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.instructor_pay_periods
     SET status = 'due', paid_at = NULL, paid_by = NULL, updated_at = now()
   WHERE id = _period_id
  RETURNING * INTO p;
  RETURN p;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_instructor_pay_period(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.roll_instructor_pay_periods() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_pay_period_paid(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unmark_pay_period_paid(UUID) TO authenticated;