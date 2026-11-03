ALTER TABLE public.staff_shift_clocks ADD COLUMN IF NOT EXISTS department text NOT NULL DEFAULT 'front_desk';

CREATE TABLE public.staff_shift_clock_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.staff_shift_clocks(id) ON DELETE CASCADE,
  edited_by uuid NOT NULL,
  old_clock_in_at timestamptz, old_clock_out_at timestamptz,
  new_clock_in_at timestamptz, new_clock_out_at timestamptz,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.staff_shift_clock_edits TO authenticated;
GRANT ALL ON public.staff_shift_clock_edits TO service_role;
ALTER TABLE public.staff_shift_clock_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read clock edits" ON public.staff_shift_clock_edits FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

-- person_key: 'user:<uuid>' | 'therapist:<uuid>' | 'instructor:<uuid>'. Hourly rates stay in staff_pay_rates (keyed by user id).
CREATE TABLE public.payroll_pay_settings (
  person_key text PRIMARY KEY,
  per_pt_session numeric(10,2),
  spa_commission_pct numeric(5,2),
  gusto_employee_id text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_pay_settings TO authenticated;
GRANT ALL ON public.payroll_pay_settings TO service_role;
ALTER TABLE public.payroll_pay_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage payroll settings" ON public.payroll_pay_settings FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]));

CREATE TABLE public.payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'approved',
  snapshot jsonb NOT NULL,
  approved_by uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  gusto_payroll_id text,
  sent_at timestamptz,
  UNIQUE (start_date, end_date)
);
GRANT SELECT, INSERT, UPDATE ON public.payroll_periods TO authenticated;
GRANT ALL ON public.payroll_periods TO service_role;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage payroll periods" ON public.payroll_periods FOR ALL TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]));

CREATE OR REPLACE FUNCTION public._clock_department(_uid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.has_role(_uid,'front_desk') THEN 'front_desk'
    WHEN public.has_role(_uid,'cafe_staff') THEN 'cafe'
    WHEN public.has_role(_uid,'childcare_staff') THEN 'kids_care'
    ELSE 'management' END
$$;

CREATE OR REPLACE FUNCTION public.frontdesk_clock_in(_pin text, _device_label text DEFAULT NULL::text)
 RETURNS TABLE(shift_id uuid, staff_user_id uuid, staff_name text, clock_in_at timestamp with time zone)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_hash TEXT; v_user_id UUID; v_recent_fails INT; v_shift_id UUID;
  v_now TIMESTAMPTZ := now(); v_device TEXT := COALESCE(_device_label, 'unknown'); v_name TEXT;
BEGIN
  IF _pin IS NULL OR _pin !~ '^[0-9]{4,12}$' THEN RAISE EXCEPTION 'Invalid PIN format'; END IF;
  SELECT COUNT(*) INTO v_recent_fails FROM public.staff_pin_attempts
  WHERE device_label = v_device AND success = false AND attempted_at > v_now - INTERVAL '15 minutes';
  IF v_recent_fails >= 5 THEN RAISE EXCEPTION 'Too many failed attempts. Wait 15 minutes.'; END IF;
  v_hash := public._staff_pin_hash(_pin);
  SELECT sp.user_id INTO v_user_id FROM public.staff_pins sp WHERE sp.pin_hash = v_hash LIMIT 1;
  IF v_user_id IS NULL THEN
    INSERT INTO public.staff_pin_attempts (device_label, success) VALUES (v_device, false);
    RAISE EXCEPTION 'Incorrect PIN';
  END IF;
  IF NOT public.has_any_role(v_user_id, ARRAY['front_desk','cafe_staff','childcare_staff','super_admin','admin','manager']::app_role[]) THEN
    RAISE EXCEPTION 'Account is not assigned to an hourly team';
  END IF;
  INSERT INTO public.staff_pin_attempts (device_label, success) VALUES (v_device, true);
  UPDATE public.staff_shift_clocks
     SET clock_out_at = v_now, auto_closed = true,
         notes = COALESCE(notes, '') || CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE E'\n' END || '[auto-closed on new clock-in]'
   WHERE staff_shift_clocks.staff_user_id = v_user_id AND staff_shift_clocks.clock_out_at IS NULL;
  INSERT INTO public.staff_shift_clocks (staff_user_id, clock_in_at, device_label, department)
  VALUES (v_user_id, v_now, v_device, public._clock_department(v_user_id))
  RETURNING id INTO v_shift_id;
  SELECT COALESCE(NULLIF(TRIM(p.first_name || ' ' || COALESCE(p.last_name, '')), ''), p.email, 'Staff')
    INTO v_name FROM public.profiles p WHERE p.id = v_user_id;
  RETURN QUERY SELECT v_shift_id, v_user_id, v_name, v_now;
END;
$function$;

CREATE OR REPLACE FUNCTION public.frontdesk_staff_roster()
 RETURNS TABLE(user_id uuid, full_name text, email text, has_pin boolean, pin_updated_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT p.id, COALESCE(NULLIF(TRIM(p.first_name || ' ' || COALESCE(p.last_name, '')), ''), p.email),
         p.email, sp.user_id IS NOT NULL, sp.updated_at
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
   AND ur.role IN ('front_desk','cafe_staff','childcare_staff','admin','super_admin','manager')
  LEFT JOIN public.staff_pins sp ON sp.user_id = p.id
  WHERE public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[])
  GROUP BY p.id, p.first_name, p.last_name, p.email, sp.user_id, sp.updated_at
  ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST;
$function$;

CREATE OR REPLACE FUNCTION public.admin_adjust_shift_clock(_shift_id uuid, _clock_in timestamptz, _clock_out timestamptz, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF coalesce(trim(_reason),'') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF _clock_out IS NOT NULL AND _clock_out <= _clock_in THEN RAISE EXCEPTION 'Clock-out must be after clock-in'; END IF;
  SELECT * INTO r FROM public.staff_shift_clocks WHERE id = _shift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift not found'; END IF;
  INSERT INTO public.staff_shift_clock_edits(shift_id, edited_by, old_clock_in_at, old_clock_out_at, new_clock_in_at, new_clock_out_at, reason)
  VALUES (_shift_id, auth.uid(), r.clock_in_at, r.clock_out_at, _clock_in, _clock_out, trim(_reason));
  UPDATE public.staff_shift_clocks SET clock_in_at = _clock_in, clock_out_at = _clock_out, admin_adjusted = true WHERE id = _shift_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_shift_clock(uuid,timestamptz,timestamptz,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_shift_clock(uuid,timestamptz,timestamptz,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_payroll_sources(_start date, _end date)
RETURNS TABLE(person_key text, person_name text, source text, detail jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT 'user:'||c.staff_user_id, COALESCE(NULLIF(TRIM(p.first_name||' '||COALESCE(p.last_name,'')),''), p.email, 'Staff'),
         'shift'::text, jsonb_build_object('id',c.id,'department',c.department,'clock_in_at',c.clock_in_at,'clock_out_at',c.clock_out_at,'auto_closed',c.auto_closed,'admin_adjusted',c.admin_adjusted,
           'hourly_rate',(SELECT r.hourly_rate FROM public.staff_pay_rates r WHERE r.person_key = c.staff_user_id::text LIMIT 1))
  FROM public.staff_shift_clocks c LEFT JOIN public.profiles p ON p.id = c.staff_user_id
  WHERE (c.clock_in_at AT TIME ZONE 'America/Detroit')::date BETWEEN _start AND _end
  UNION ALL
  SELECT 'therapist:'||t.id, t.full_name, 'spa'::text,
         jsonb_build_object('id',sa.id,'date',sa.appointment_date,'service',sa.service_name,'price',COALESCE(sa.service_price,0),'tip',COALESCE(sa.tip_amount,0))
  FROM public.spa_appointments sa JOIN public.spa_therapists t ON t.id = sa.staff_id
  WHERE sa.status='completed' AND sa.appointment_date BETWEEN _start AND _end
  UNION ALL
  SELECT 'instructor:'||i.id, TRIM(i.first_name||' '||COALESCE(i.last_name,'')), 'pt'::text,
         jsonb_build_object('id',a.id,'starts_at',a.starts_at)
  FROM public.pt_appointments a JOIN public.instructors i ON i.id = a.instructor_id
  WHERE a.status='completed' AND (a.starts_at AT TIME ZONE 'America/Detroit')::date BETWEEN _start AND _end
  UNION ALL
  SELECT 'instructor:'||i.id, TRIM(i.first_name||' '||COALESCE(i.last_name,'')), 'class'::text,
         jsonb_build_object('id',x.id,'date',x.item_date,'amount',COALESCE(x.amount,0))
  FROM public.instructor_pay_items x JOIN public.instructors i ON i.id = x.instructor_id
  WHERE x.item_date BETWEEN _start AND _end;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_payroll_sources(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_payroll_sources(date,date) TO authenticated;