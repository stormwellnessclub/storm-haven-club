
-- =========================================================================
-- STAFF PINS (never readable from client)
-- =========================================================================
CREATE TABLE public.staff_pins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

GRANT ALL ON public.staff_pins TO service_role;
-- Deliberately NO grants to authenticated or anon — access is via SECURITY DEFINER RPCs only.

ALTER TABLE public.staff_pins ENABLE ROW LEVEL SECURITY;

-- No policies = locked. Only service_role and SECURITY DEFINER functions can access.

-- =========================================================================
-- STAFF SHIFT CLOCKS
-- =========================================================================
CREATE TABLE public.staff_shift_clocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clock_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_out_at TIMESTAMPTZ,
  device_label TEXT,
  clock_in_ip TEXT,
  clock_out_ip TEXT,
  notes TEXT,
  auto_closed BOOLEAN NOT NULL DEFAULT false,
  admin_adjusted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_shift_clocks_user ON public.staff_shift_clocks(staff_user_id, clock_in_at DESC);
CREATE INDEX idx_staff_shift_clocks_open ON public.staff_shift_clocks(staff_user_id) WHERE clock_out_at IS NULL;

GRANT SELECT ON public.staff_shift_clocks TO authenticated;
GRANT ALL ON public.staff_shift_clocks TO service_role;

ALTER TABLE public.staff_shift_clocks ENABLE ROW LEVEL SECURITY;

-- Staffers can read their own timesheet
CREATE POLICY "Staff read own shifts"
ON public.staff_shift_clocks FOR SELECT
TO authenticated
USING (staff_user_id = auth.uid());

-- Admins/managers can read all shifts
CREATE POLICY "Admins/managers read all shifts"
ON public.staff_shift_clocks FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

-- Admins can adjust shifts after the fact (edit / delete)
CREATE POLICY "Admins update shifts"
ON public.staff_shift_clocks FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins delete shifts"
ON public.staff_shift_clocks FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- No INSERT policy — writes go through SECURITY DEFINER RPCs.

CREATE TRIGGER staff_shift_clocks_updated_at
BEFORE UPDATE ON public.staff_shift_clocks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- RATE LIMIT TABLE (per-device PIN attempts)
-- =========================================================================
CREATE TABLE public.staff_pin_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_label TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_staff_pin_attempts_device_time
  ON public.staff_pin_attempts(device_label, attempted_at DESC);

GRANT ALL ON public.staff_pin_attempts TO service_role;
ALTER TABLE public.staff_pin_attempts ENABLE ROW LEVEL SECURITY;
-- No policies = locked to service_role / SECURITY DEFINER only.

-- =========================================================================
-- HASH HELPER  (pgcrypto extension is already enabled per project defaults)
-- =========================================================================
CREATE OR REPLACE FUNCTION public._staff_pin_hash(_pin TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  -- Salted SHA-256. Salt is per-project constant baked into the function body,
  -- which keeps a stolen table from being trivially rainbow-tabled.
  SELECT encode(
    extensions.digest('storm::frontdesk::v1::' || _pin, 'sha256'),
    'hex'
  );
$$;

-- =========================================================================
-- SET / RESET A STAFFER'S PIN  (admin-only)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_set_staff_pin(
  _staff_user_id UUID,
  _pin TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin'::app_role)
       OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Only admins can set staff PINs';
  END IF;

  IF _pin IS NULL OR length(_pin) < 4 OR length(_pin) > 12 OR _pin !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'PIN must be 4-12 digits';
  END IF;

  INSERT INTO public.staff_pins (user_id, pin_hash, updated_by)
  VALUES (_staff_user_id, public._staff_pin_hash(_pin), auth.uid())
  ON CONFLICT (user_id) DO UPDATE
    SET pin_hash = EXCLUDED.pin_hash,
        updated_at = now(),
        updated_by = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_staff_pin(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_staff_pin(UUID, TEXT) TO authenticated;

-- =========================================================================
-- CLOCK IN via PIN
-- =========================================================================
CREATE OR REPLACE FUNCTION public.frontdesk_clock_in(
  _pin TEXT,
  _device_label TEXT DEFAULT NULL
) RETURNS TABLE (
  shift_id UUID,
  staff_user_id UUID,
  staff_name TEXT,
  clock_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
  v_user_id UUID;
  v_recent_fails INT;
  v_shift_id UUID;
  v_now TIMESTAMPTZ := now();
  v_device TEXT := COALESCE(_device_label, 'unknown');
  v_name TEXT;
BEGIN
  IF _pin IS NULL OR _pin !~ '^[0-9]{4,12}$' THEN
    RAISE EXCEPTION 'Invalid PIN format';
  END IF;

  -- Rate limit: 5 failed attempts in last 15 minutes per device
  SELECT COUNT(*) INTO v_recent_fails
  FROM public.staff_pin_attempts
  WHERE device_label = v_device
    AND success = false
    AND attempted_at > v_now - INTERVAL '15 minutes';

  IF v_recent_fails >= 5 THEN
    RAISE EXCEPTION 'Too many failed attempts. Wait 15 minutes.';
  END IF;

  v_hash := public._staff_pin_hash(_pin);

  SELECT sp.user_id INTO v_user_id
  FROM public.staff_pins sp
  WHERE sp.pin_hash = v_hash
  LIMIT 1;

  IF v_user_id IS NULL THEN
    INSERT INTO public.staff_pin_attempts (device_label, success)
    VALUES (v_device, false);
    RAISE EXCEPTION 'Incorrect PIN';
  END IF;

  -- Confirm this user still has the front_desk role (or admin/manager)
  IF NOT (public.has_role(v_user_id, 'front_desk'::app_role)
       OR public.has_role(v_user_id, 'super_admin'::app_role)
       OR public.has_role(v_user_id, 'admin'::app_role)
       OR public.has_role(v_user_id, 'manager'::app_role)) THEN
    RAISE EXCEPTION 'Account is not assigned to Front Desk';
  END IF;

  -- Log successful attempt
  INSERT INTO public.staff_pin_attempts (device_label, success)
  VALUES (v_device, true);

  -- Close any lingering open shift for this staffer (idle safety)
  UPDATE public.staff_shift_clocks
     SET clock_out_at = v_now,
         auto_closed = true,
         notes = COALESCE(notes, '') ||
                 CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE E'\n' END ||
                 '[auto-closed on new clock-in]'
   WHERE staff_user_id = v_user_id
     AND clock_out_at IS NULL;

  -- Open a fresh shift
  INSERT INTO public.staff_shift_clocks (staff_user_id, clock_in_at, device_label)
  VALUES (v_user_id, v_now, v_device)
  RETURNING id INTO v_shift_id;

  SELECT COALESCE(NULLIF(TRIM(p.first_name || ' ' || COALESCE(p.last_name, '')), ''), p.email, 'Staff')
    INTO v_name
  FROM public.profiles p
  WHERE p.id = v_user_id;

  RETURN QUERY SELECT v_shift_id, v_user_id, v_name, v_now;
END;
$$;

REVOKE ALL ON FUNCTION public.frontdesk_clock_in(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.frontdesk_clock_in(TEXT, TEXT) TO authenticated, anon;
-- anon allowed because the kiosk device may not yet have a Supabase session.

-- =========================================================================
-- CLOCK OUT via PIN
-- =========================================================================
CREATE OR REPLACE FUNCTION public.frontdesk_clock_out(
  _pin TEXT,
  _device_label TEXT DEFAULT NULL
) RETURNS TABLE (
  shift_id UUID,
  staff_user_id UUID,
  staff_name TEXT,
  clock_in_at TIMESTAMPTZ,
  clock_out_at TIMESTAMPTZ,
  minutes_worked INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
  v_user_id UUID;
  v_recent_fails INT;
  v_shift RECORD;
  v_now TIMESTAMPTZ := now();
  v_device TEXT := COALESCE(_device_label, 'unknown');
  v_name TEXT;
BEGIN
  IF _pin IS NULL OR _pin !~ '^[0-9]{4,12}$' THEN
    RAISE EXCEPTION 'Invalid PIN format';
  END IF;

  SELECT COUNT(*) INTO v_recent_fails
  FROM public.staff_pin_attempts
  WHERE device_label = v_device
    AND success = false
    AND attempted_at > v_now - INTERVAL '15 minutes';

  IF v_recent_fails >= 5 THEN
    RAISE EXCEPTION 'Too many failed attempts. Wait 15 minutes.';
  END IF;

  v_hash := public._staff_pin_hash(_pin);

  SELECT sp.user_id INTO v_user_id
  FROM public.staff_pins sp
  WHERE sp.pin_hash = v_hash
  LIMIT 1;

  IF v_user_id IS NULL THEN
    INSERT INTO public.staff_pin_attempts (device_label, success)
    VALUES (v_device, false);
    RAISE EXCEPTION 'Incorrect PIN';
  END IF;

  INSERT INTO public.staff_pin_attempts (device_label, success)
  VALUES (v_device, true);

  UPDATE public.staff_shift_clocks
     SET clock_out_at = v_now
   WHERE staff_user_id = v_user_id
     AND clock_out_at IS NULL
   RETURNING id, clock_in_at INTO v_shift;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No open shift found for this staffer';
  END IF;

  SELECT COALESCE(NULLIF(TRIM(p.first_name || ' ' || COALESCE(p.last_name, '')), ''), p.email, 'Staff')
    INTO v_name
  FROM public.profiles p
  WHERE p.id = v_user_id;

  RETURN QUERY SELECT
    v_shift.id,
    v_user_id,
    v_name,
    v_shift.clock_in_at,
    v_now,
    GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_shift.clock_in_at))::INT / 60);
END;
$$;

REVOKE ALL ON FUNCTION public.frontdesk_clock_out(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.frontdesk_clock_out(TEXT, TEXT) TO authenticated, anon;

-- =========================================================================
-- LIST OPEN SHIFTS (kiosk header "who's on desk")
-- =========================================================================
CREATE OR REPLACE FUNCTION public.frontdesk_open_shifts()
RETURNS TABLE (
  shift_id UUID,
  staff_user_id UUID,
  staff_name TEXT,
  clock_in_at TIMESTAMPTZ,
  device_label TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT sc.id,
         sc.staff_user_id,
         COALESCE(NULLIF(TRIM(p.first_name || ' ' || COALESCE(p.last_name, '')), ''), p.email, 'Staff'),
         sc.clock_in_at,
         sc.device_label
  FROM public.staff_shift_clocks sc
  LEFT JOIN public.profiles p ON p.id = sc.staff_user_id
  WHERE sc.clock_out_at IS NULL
  ORDER BY sc.clock_in_at DESC;
$$;

REVOKE ALL ON FUNCTION public.frontdesk_open_shifts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.frontdesk_open_shifts() TO authenticated, anon;

-- =========================================================================
-- WHICH FRONT DESK STAFFERS HAVE A PIN CONFIGURED  (admin roster helper)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.frontdesk_staff_roster()
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  email TEXT,
  has_pin BOOLEAN,
  pin_updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.id,
         COALESCE(NULLIF(TRIM(p.first_name || ' ' || COALESCE(p.last_name, '')), ''), p.email),
         p.email,
         sp.user_id IS NOT NULL,
         sp.updated_at
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
   AND ur.role IN ('front_desk'::app_role, 'admin'::app_role, 'super_admin'::app_role, 'manager'::app_role)
  LEFT JOIN public.staff_pins sp ON sp.user_id = p.id
  WHERE public.has_role(auth.uid(), 'super_admin'::app_role)
     OR public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'manager'::app_role)
  GROUP BY p.id, p.first_name, p.last_name, p.email, sp.user_id, sp.updated_at
  ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.frontdesk_staff_roster() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.frontdesk_staff_roster() TO authenticated;

-- =========================================================================
-- AUTO-CLOSE OPEN SHIFTS PAST MIDNIGHT (America/Chicago)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.frontdesk_auto_close_stale_shifts()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closed INT;
BEGIN
  WITH updated AS (
    UPDATE public.staff_shift_clocks
       SET clock_out_at = clock_in_at + INTERVAL '12 hours',
           auto_closed = true,
           notes = COALESCE(notes, '') ||
                   CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE E'\n' END ||
                   '[auto-closed: shift left open past midnight club time]'
     WHERE clock_out_at IS NULL
       AND clock_in_at < (
         (date_trunc('day', (now() AT TIME ZONE 'America/Chicago'))
           AT TIME ZONE 'America/Chicago')
       )
     RETURNING 1
  )
  SELECT COUNT(*) INTO v_closed FROM updated;
  RETURN v_closed;
END;
$$;

REVOKE ALL ON FUNCTION public.frontdesk_auto_close_stale_shifts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.frontdesk_auto_close_stale_shifts() TO service_role;

-- Schedule daily at 05:00 UTC (~00:00 club time)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('frontdesk_auto_close_stale_shifts')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'frontdesk_auto_close_stale_shifts');
    PERFORM cron.schedule(
      'frontdesk_auto_close_stale_shifts',
      '5 5 * * *',
      $cron$SELECT public.frontdesk_auto_close_stale_shifts();$cron$
    );
  END IF;
END $$;
