-- Configuration table for scheduled functions
CREATE TABLE IF NOT EXISTS public.scheduled_functions_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  supabase_url TEXT NOT NULL DEFAULT 'https://cqzmrdzwgsujgbjqpoxh.supabase.co',
  anon_key TEXT NOT NULL DEFAULT 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxem1yZHp3Z3N1amdianFwb3hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NDA4MzksImV4cCI6MjA4MjMxNjgzOX0.kPt7tgmDQy5sQ1aDGFzi43dNYcqDE4fMDJnZ8-c2_1o',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default config if not exists
INSERT INTO public.scheduled_functions_config (id, supabase_url, anon_key)
VALUES (
  'default',
  'https://cqzmrdzwgsujgbjqpoxh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxem1yZHp3Z3N1amdianFwb3hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NDA4MzksImV4cCI6MjA4MjMxNjgzOX0.kPt7tgmDQy5sQ1aDGFzi43dNYcqDE4fMDJnZ8-c2_1o'
)
ON CONFLICT (id) DO NOTHING;

-- Scanner Settings Table
CREATE TABLE IF NOT EXISTS public.scanner_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_name TEXT UNIQUE NOT NULL,
  auto_check_in_enabled BOOLEAN DEFAULT false,
  audio_feedback_enabled BOOLEAN DEFAULT true,
  require_override_reason BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default scanner settings
INSERT INTO public.scanner_settings (location_name)
VALUES ('front_desk')
ON CONFLICT (location_name) DO NOTHING;

-- Scanner Access Logs Table
CREATE TABLE IF NOT EXISTS public.scanner_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id),
  member_id_text TEXT,
  scanned_by UUID,
  access_granted BOOLEAN NOT NULL,
  access_denied_reason TEXT,
  auto_checked_in BOOLEAN DEFAULT false,
  check_in_id UUID REFERENCES public.check_ins(id),
  payment_status JSONB,
  scanned_at TIMESTAMPTZ DEFAULT now(),
  override_used BOOLEAN DEFAULT false,
  override_reason TEXT,
  device_type TEXT CHECK (device_type IN ('physical_scanner', 'camera', 'manual_entry')),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_scanner_access_logs_scanned_at ON public.scanner_access_logs(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanner_access_logs_member_id ON public.scanner_access_logs(member_id);

-- Guest Passes Table
CREATE TABLE IF NOT EXISTS public.guest_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  price_paid NUMERIC(10,2) NOT NULL DEFAULT 60.00,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted', 'expired')),
  purchased_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '1 day'),
  used_at TIMESTAMPTZ,
  sold_by UUID,
  stripe_payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_passes_status ON public.guest_passes(status);
CREATE INDEX IF NOT EXISTS idx_guest_passes_purchased_at ON public.guest_passes(purchased_at DESC);

-- RLS for scanner_settings
ALTER TABLE public.scanner_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view scanner settings"
  ON public.scanner_settings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'admin', 'manager', 'front_desk')
  ));

CREATE POLICY "Staff can update scanner settings"
  ON public.scanner_settings FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'admin', 'manager')
  ));

-- RLS for scanner_access_logs
ALTER TABLE public.scanner_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view scanner logs"
  ON public.scanner_access_logs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'admin', 'manager', 'front_desk')
  ));

CREATE POLICY "Staff can insert scanner logs"
  ON public.scanner_access_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'admin', 'manager', 'front_desk')
  ));

-- RLS for guest_passes
ALTER TABLE public.guest_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view guest passes"
  ON public.guest_passes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'admin', 'manager', 'front_desk')
  ));

CREATE POLICY "Staff can insert guest passes"
  ON public.guest_passes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'admin', 'manager', 'front_desk')
  ));

CREATE POLICY "Staff can update guest passes"
  ON public.guest_passes FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'admin', 'manager', 'front_desk')
  ));

-- Function to get scheduled functions config
CREATE OR REPLACE FUNCTION public.get_scheduled_functions_config()
RETURNS TABLE(supabase_url TEXT, anon_key TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT c.supabase_url, c.anon_key
  FROM public.scheduled_functions_config c
  WHERE c.id = 'default';
END;
$$;

-- Process Member Scan RPC Function
CREATE OR REPLACE FUNCTION public.process_member_scan(
  p_member_id_text TEXT,
  p_scanned_by UUID,
  p_auto_check_in BOOLEAN DEFAULT false,
  p_device_type TEXT DEFAULT 'manual_entry',
  p_override BOOLEAN DEFAULT false,
  p_override_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member RECORD;
  v_access_granted BOOLEAN := false;
  v_denial_reason TEXT;
  v_check_in_id UUID;
  v_log_id UUID;
  v_payment_status JSONB;
BEGIN
  -- Find member by member_id (STM-XXXXXX format)
  SELECT * INTO v_member 
  FROM public.members 
  WHERE member_id = p_member_id_text;
  
  IF v_member IS NULL THEN
    INSERT INTO public.scanner_access_logs (
      member_id_text, scanned_by, access_granted, 
      access_denied_reason, device_type
    ) VALUES (
      p_member_id_text, p_scanned_by, false, 
      'member_not_found', p_device_type
    )
    RETURNING id INTO v_log_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'access_granted', false,
      'denial_reason', 'member_not_found',
      'log_id', v_log_id,
      'message', 'Member not found'
    );
  END IF;

  -- Build payment status
  v_payment_status := jsonb_build_object(
    'isAnnualFeeOverdue', v_member.annual_fee_paid_at IS NULL 
      OR v_member.annual_fee_paid_at < (NOW() - INTERVAL '1 year'),
    'isDuesPastDue', v_member.stripe_subscription_id IS NULL
  );

  -- Determine access based on status
  IF v_member.status = 'active' THEN
    IF (v_payment_status->>'isAnnualFeeOverdue')::boolean 
       OR (v_payment_status->>'isDuesPastDue')::boolean THEN
      v_denial_reason := 'payment_overdue';
    ELSE
      v_access_granted := true;
    END IF;
  ELSIF v_member.status = 'frozen' THEN
    v_denial_reason := 'membership_frozen';
  ELSIF v_member.status IN ('cancelled', 'suspended') THEN
    v_denial_reason := 'membership_' || v_member.status;
  ELSE
    v_denial_reason := 'membership_inactive';
  END IF;

  -- Handle override
  IF p_override AND NOT v_access_granted THEN
    v_access_granted := true;
    v_denial_reason := NULL;
  END IF;

  -- Auto check-in if enabled and access granted
  IF v_access_granted AND p_auto_check_in THEN
    INSERT INTO public.check_ins (member_id, checked_in_at)
    VALUES (v_member.id, NOW())
    RETURNING id INTO v_check_in_id;
  END IF;

  -- Log the scan
  INSERT INTO public.scanner_access_logs (
    member_id, member_id_text, scanned_by, access_granted,
    access_denied_reason, auto_checked_in, check_in_id,
    payment_status, override_used, override_reason, device_type
  ) VALUES (
    v_member.id, p_member_id_text, p_scanned_by, v_access_granted,
    v_denial_reason, (v_check_in_id IS NOT NULL), v_check_in_id,
    v_payment_status, p_override, p_override_reason, p_device_type
  )
  RETURNING id INTO v_log_id;

  RETURN jsonb_build_object(
    'success', true,
    'access_granted', v_access_granted,
    'denial_reason', v_denial_reason,
    'check_in_id', v_check_in_id,
    'log_id', v_log_id,
    'member', jsonb_build_object(
      'id', v_member.id,
      'member_id', v_member.member_id,
      'first_name', v_member.first_name,
      'last_name', v_member.last_name,
      'membership_type', v_member.membership_type,
      'status', v_member.status,
      'email', v_member.email
    ),
    'payment_status', v_payment_status
  );
END;
$$;