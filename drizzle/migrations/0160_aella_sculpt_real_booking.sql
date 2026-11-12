-- Zones: staff choose whether an area books online or takes requests
ALTER TABLE public.spa_treatment_zones ADD COLUMN IF NOT EXISTS booking_mode text NOT NULL DEFAULT 'book';
ALTER TABLE public.spa_treatment_zones DROP CONSTRAINT IF EXISTS spa_treatment_zones_booking_mode_check;
ALTER TABLE public.spa_treatment_zones ADD CONSTRAINT spa_treatment_zones_booking_mode_check CHECK (booking_mode IN ('book','request'));

-- Packages: expiration in calendar months
ALTER TABLE public.spa_treatment_packages ADD COLUMN IF NOT EXISTS expires_after_months integer;
ALTER TABLE public.spa_treatment_packages DROP CONSTRAINT IF EXISTS spa_treatment_packages_expires_months_check;
ALTER TABLE public.spa_treatment_packages ADD CONSTRAINT spa_treatment_packages_expires_months_check CHECK (expires_after_months IS NULL OR expires_after_months BETWEEN 1 AND 60);
COMMENT ON COLUMN public.spa_treatment_packages.expires_after_days IS 'DEPRECATED: replaced by expires_after_months';

-- Services: stable key for package/zone services and a public-menu switch
ALTER TABLE public.spa_services ADD COLUMN IF NOT EXISTS service_key text;
ALTER TABLE public.spa_services ADD COLUMN IF NOT EXISTS public_menu boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS spa_services_service_key_key ON public.spa_services(service_key) WHERE service_key IS NOT NULL;

-- Requests can carry the chosen area
ALTER TABLE public.spa_service_requests ADD COLUMN IF NOT EXISTS treatment_zone_id uuid REFERENCES public.spa_treatment_zones(id) ON DELETE SET NULL;
ALTER TABLE public.spa_service_requests ADD COLUMN IF NOT EXISTS treatment_zone_name text;

CREATE OR REPLACE FUNCTION public.set_spa_request_zone_name()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE z public.spa_treatment_zones;
BEGIN
  IF NEW.treatment_zone_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO z FROM public.spa_treatment_zones WHERE id = NEW.treatment_zone_id;
  IF NOT FOUND OR NOT z.is_active THEN
    RAISE EXCEPTION 'That treatment area is not available. Please choose another.';
  END IF;
  NEW.treatment_zone_name := z.name;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS spa_service_requests_zone_name ON public.spa_service_requests;
CREATE TRIGGER spa_service_requests_zone_name BEFORE INSERT OR UPDATE OF treatment_zone_id ON public.spa_service_requests
FOR EACH ROW EXECUTE FUNCTION public.set_spa_request_zone_name();

-- Purchased single treatments and series
CREATE TABLE IF NOT EXISTS public.spa_client_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  member_id uuid,
  package_id uuid REFERENCES public.spa_treatment_packages(id) ON DELETE SET NULL,
  service_key text NOT NULL,
  package_name text NOT NULL,
  sessions_total integer NOT NULL CHECK (sessions_total > 0),
  price_paid_cents integer NOT NULL DEFAULT 0 CHECK (price_paid_cents >= 0),
  processing_fee_cents integer NOT NULL DEFAULT 0 CHECK (processing_fee_cents >= 0),
  purchased_at timestamptz NOT NULL DEFAULT now(),
  expires_on date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','refunded','void')),
  payment_intent_id text UNIQUE,
  source text NOT NULL DEFAULT 'online',
  created_by_user_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.spa_client_packages TO authenticated;
GRANT ALL ON public.spa_client_packages TO service_role;
ALTER TABLE public.spa_client_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients view own spa packages" ON public.spa_client_packages FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Spa staff view spa packages" ON public.spa_client_packages FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role,'spa_staff'::app_role,'front_desk'::app_role]));
CREATE POLICY "Managers update spa packages" ON public.spa_client_packages FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role]));
CREATE INDEX IF NOT EXISTS spa_client_packages_user_idx ON public.spa_client_packages(user_id);
DROP TRIGGER IF EXISTS update_spa_client_packages_updated_at ON public.spa_client_packages;
CREATE TRIGGER update_spa_client_packages_updated_at BEFORE UPDATE ON public.spa_client_packages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Appointments: which series paid for it, and first or returning visit
ALTER TABLE public.spa_appointments ADD COLUMN IF NOT EXISTS client_package_id uuid REFERENCES public.spa_client_packages(id) ON DELETE SET NULL;
ALTER TABLE public.spa_appointments ADD COLUMN IF NOT EXISTS visit_type text;
ALTER TABLE public.spa_appointments DROP CONSTRAINT IF EXISTS spa_appointments_visit_type_check;
ALTER TABLE public.spa_appointments ADD CONSTRAINT spa_appointments_visit_type_check CHECK (visit_type IS NULL OR visit_type IN ('first','returning'));
CREATE INDEX IF NOT EXISTS spa_appointments_client_package_idx ON public.spa_appointments(client_package_id) WHERE client_package_id IS NOT NULL;

-- A series can only pay for its own client's treatment, before it expires, while sessions remain
CREATE OR REPLACE FUNCTION public.enforce_spa_client_package_use()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.spa_client_packages; v_key text; v_used integer;
BEGIN
  IF NEW.client_package_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.client_package_id IS NOT DISTINCT FROM OLD.client_package_id
     AND NEW.appointment_date IS NOT DISTINCT FROM OLD.appointment_date
     AND NOT (OLD.status = 'cancelled' AND NEW.status <> 'cancelled') THEN
    RETURN NEW;
  END IF;
  SELECT * INTO p FROM public.spa_client_packages WHERE id = NEW.client_package_id FOR UPDATE;
  IF NOT FOUND OR p.status <> 'active' THEN RAISE EXCEPTION 'This treatment series is no longer active.'; END IF;
  IF p.user_id IS DISTINCT FROM NEW.user_id THEN RAISE EXCEPTION 'This treatment series belongs to another client.'; END IF;
  SELECT service_key INTO v_key FROM public.spa_services WHERE id::text = NEW.service_id;
  IF v_key IS DISTINCT FROM p.service_key THEN RAISE EXCEPTION 'This treatment series is for a different treatment.'; END IF;
  IF p.expires_on IS NOT NULL AND NEW.appointment_date > p.expires_on THEN
    RAISE EXCEPTION 'This treatment series expires on %. Please choose a date on or before then.', to_char(p.expires_on, 'FMMonth FMDD, YYYY');
  END IF;
  IF NEW.status <> 'cancelled' THEN
    SELECT count(*) INTO v_used FROM public.spa_appointments
      WHERE client_package_id = p.id AND status <> 'cancelled' AND id <> NEW.id;
    IF v_used >= p.sessions_total THEN RAISE EXCEPTION 'There are no sessions left in this treatment series.'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS spa_appointments_client_package_use ON public.spa_appointments;
CREATE TRIGGER spa_appointments_client_package_use BEFORE INSERT OR UPDATE OF client_package_id, appointment_date, status ON public.spa_appointments
FOR EACH ROW EXECUTE FUNCTION public.enforce_spa_client_package_use();

-- Zone services need an area; request-only areas can only be booked by staff
CREATE OR REPLACE FUNCTION public.enforce_spa_zone_booking_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_key text; z public.spa_treatment_zones;
BEGIN
  SELECT service_key INTO v_key FROM public.spa_services WHERE id::text = NEW.service_id;
  IF v_key IS NULL OR NOT EXISTS (SELECT 1 FROM public.spa_treatment_zones WHERE service_key = v_key) THEN RETURN NEW; END IF;
  IF NEW.treatment_zone_id IS NULL THEN RAISE EXCEPTION 'Please choose a treatment area for this appointment.'; END IF;
  SELECT * INTO z FROM public.spa_treatment_zones WHERE id = NEW.treatment_zone_id;
  IF NOT FOUND OR z.service_key <> v_key THEN RAISE EXCEPTION 'That treatment area does not belong to this treatment.'; END IF;
  IF z.booking_mode = 'request' AND auth.uid() IS NOT NULL
     AND NOT public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role,'spa_staff'::app_role,'front_desk'::app_role]) THEN
    RAISE EXCEPTION 'That area takes appointment requests for now. Please send a request instead.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS spa_appointments_zone_booking_rules ON public.spa_appointments;
CREATE TRIGGER spa_appointments_zone_booking_rules BEFORE INSERT ON public.spa_appointments
FOR EACH ROW EXECUTE FUNCTION public.enforce_spa_zone_booking_rules();

-- Record a paid package (server only). Expiration counts calendar months from the Detroit purchase date.
CREATE OR REPLACE FUNCTION public.record_spa_client_package(
  p_user_id uuid, p_member_id uuid, p_package_id uuid, p_price_paid_cents integer,
  p_processing_fee_cents integer, p_payment_intent_id text, p_source text DEFAULT 'online', p_created_by uuid DEFAULT NULL)
RETURNS public.spa_client_packages LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pk public.spa_treatment_packages; r public.spa_client_packages; v_today date := (now() AT TIME ZONE 'America/Detroit')::date;
BEGIN
  SELECT * INTO r FROM public.spa_client_packages WHERE payment_intent_id = p_payment_intent_id;
  IF FOUND THEN RETURN r; END IF;
  SELECT * INTO pk FROM public.spa_treatment_packages WHERE id = p_package_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Package not found'; END IF;
  INSERT INTO public.spa_client_packages(user_id, member_id, package_id, service_key, package_name, sessions_total,
    price_paid_cents, processing_fee_cents, expires_on, payment_intent_id, source, created_by_user_id)
  VALUES (p_user_id, p_member_id, pk.id, pk.service_key,
    CASE WHEN pk.session_count = 1 THEN pk.name ELSE pk.session_count || '-Treatment ' || pk.name END,
    pk.session_count, p_price_paid_cents, p_processing_fee_cents,
    CASE WHEN pk.expires_after_months IS NULL THEN NULL ELSE (v_today + make_interval(months => pk.expires_after_months))::date END,
    p_payment_intent_id, COALESCE(p_source, 'online'), p_created_by)
  RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.record_spa_client_package(uuid, uuid, uuid, integer, integer, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_spa_client_package(uuid, uuid, uuid, integer, integer, text, text, uuid) TO service_role;

-- Check or book one Aella Sculpt-style session (server only): window, notice, conflicts, zone, package
CREATE OR REPLACE FUNCTION public.book_spa_package_session(
  p_user_id uuid, p_service_key text, p_zone_id uuid, p_visit_type text, p_date date, p_time time,
  p_client_package_id uuid DEFAULT NULL, p_notes text DEFAULT NULL, p_check_only boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.spa_services; z public.spa_treatment_zones; w record; c record; v_member uuid; a public.spa_appointments;
  v_now timestamp := now() AT TIME ZONE 'America/Detroit'; v_end time;
BEGIN
  SELECT * INTO s FROM public.spa_services WHERE service_key = p_service_key AND is_active;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'This treatment is not open for booking.'); END IF;
  SELECT * INTO z FROM public.spa_treatment_zones WHERE id = p_zone_id AND service_key = p_service_key AND is_active;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Please choose a treatment area.'); END IF;
  IF z.booking_mode <> 'book' THEN RETURN jsonb_build_object('ok', false, 'code', 'request_only', 'error', 'That area takes appointment requests for now.'); END IF;
  IF p_visit_type IS NULL OR p_visit_type NOT IN ('first','returning') THEN RETURN jsonb_build_object('ok', false, 'error', 'Please choose first or returning visit.'); END IF;
  IF p_date + p_time < v_now + interval '2 hours' THEN RETURN jsonb_build_object('ok', false, 'error', 'Choose a time at least 2 hours from now.'); END IF;
  IF p_date > v_now::date + 93 THEN RETURN jsonb_build_object('ok', false, 'error', 'Choose a date within the next three months.'); END IF;
  v_end := p_time + make_interval(mins => s.duration_minutes);
  IF v_end <= p_time THEN RETURN jsonb_build_object('ok', false, 'error', 'That time is not available.'); END IF;
  SELECT therapist_id, room_id INTO w FROM public.spa_service_availability
   WHERE service_id = s.id AND is_active
     AND ((specific_date = p_date) OR (specific_date IS NULL AND day_of_week = extract(dow FROM p_date)::int))
     AND (starts_on IS NULL OR p_date >= starts_on)
     AND start_time <= p_time AND v_end <= end_time
   ORDER BY (therapist_id IS NOT NULL AND room_id IS NOT NULL) DESC, (therapist_id IS NOT NULL) DESC
   LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'slot_taken', 'error', 'That time is not available. Please pick another.'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('spa-slot-' || COALESCE(w.room_id::text, '') || '-' || p_date::text));
  PERFORM pg_advisory_xact_lock(hashtext('spa-staff-' || COALESCE(w.therapist_id::text, '') || '-' || p_date::text));
  SELECT * INTO c FROM public.check_spa_appointment_conflict(p_date, p_time, s.duration_minutes, s.cleanup_minutes, w.therapist_id, w.room_id, NULL);
  IF c.has_conflict THEN RETURN jsonb_build_object('ok', false, 'code', 'slot_taken', 'error', 'Sorry, that time was just taken. Please pick another.'); END IF;
  IF p_check_only THEN RETURN jsonb_build_object('ok', true, 'therapist_id', w.therapist_id, 'room_id', w.room_id); END IF;
  IF p_client_package_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Choose a treatment option.'); END IF;
  SELECT id INTO v_member FROM public.members WHERE user_id = p_user_id AND status <> 'cancelled' LIMIT 1;
  INSERT INTO public.spa_appointments(user_id, member_id, service_id, service_name, service_category, service_price, member_price,
    appointment_date, appointment_time, duration_minutes, cleanup_minutes, status, member_notes, payment_method, payment_intent_id,
    amount_paid, staff_id, room_id, created_by_user_id, created_via, treatment_zone_id, visit_type, client_package_id)
  SELECT p_user_id, v_member, s.id::text, s.name, s.category, s.price, NULL,
    p_date, p_time, s.duration_minutes, s.cleanup_minutes, 'confirmed', NULLIF(trim(COALESCE(p_notes, '')), ''), 'spa_package', cp.payment_intent_id,
    0, w.therapist_id, w.room_id, p_user_id, CASE WHEN v_member IS NULL THEN 'non_member_portal' ELSE 'member_portal' END, z.id, p_visit_type, cp.id
  FROM public.spa_client_packages cp WHERE cp.id = p_client_package_id
  RETURNING * INTO a;
  IF a.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Treatment series not found.'); END IF;
  RETURN jsonb_build_object('ok', true, 'appointment', to_jsonb(a));
EXCEPTION WHEN raise_exception THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END $$;
REVOKE ALL ON FUNCTION public.book_spa_package_session(uuid, text, uuid, text, date, time, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_spa_package_session(uuid, text, uuid, text, date, time, uuid, text, boolean) TO service_role;

-- Staff list of purchased series with sessions used
CREATE OR REPLACE FUNCTION public.admin_spa_client_packages(p_service_key text DEFAULT NULL)
RETURNS TABLE(id uuid, user_id uuid, client_name text, client_email text, package_name text, service_key text, sessions_total integer,
  sessions_used integer, price_paid_cents integer, purchased_at timestamptz, expires_on date, status text, next_appointment date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cp.id, cp.user_id,
    NULLIF(trim(COALESCE(pr.first_name,'') || ' ' || COALESCE(pr.last_name,'')), ''), pr.email,
    cp.package_name, cp.service_key, cp.sessions_total,
    (SELECT count(*)::int FROM public.spa_appointments a WHERE a.client_package_id = cp.id AND a.status <> 'cancelled'),
    cp.price_paid_cents, cp.purchased_at, cp.expires_on, cp.status,
    (SELECT min(a.appointment_date) FROM public.spa_appointments a WHERE a.client_package_id = cp.id AND a.status = 'confirmed' AND a.appointment_date >= (now() AT TIME ZONE 'America/Detroit')::date)
  FROM public.spa_client_packages cp
  LEFT JOIN public.profiles pr ON pr.user_id = cp.user_id
  WHERE public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'manager'::app_role,'spa_staff'::app_role,'front_desk'::app_role])
    AND (p_service_key IS NULL OR cp.service_key = p_service_key)
  ORDER BY cp.purchased_at DESC
$$;
REVOKE ALL ON FUNCTION public.admin_spa_client_packages(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_spa_client_packages(text) TO authenticated, service_role;