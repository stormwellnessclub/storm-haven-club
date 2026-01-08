-- Member Scanner Access System
-- Creates tables for scanner access logging and settings, plus RPC function for processing scans

-- Create scanner_access_logs table
CREATE TABLE IF NOT EXISTS scanner_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  member_id_text text NOT NULL, -- STM-000001
  scanned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  access_granted boolean NOT NULL,
  access_denied_reason text, -- 'payment_overdue', 'membership_expired', 'membership_frozen', etc.
  auto_checked_in boolean DEFAULT false,
  check_in_id uuid REFERENCES check_ins(id) ON DELETE SET NULL,
  payment_status jsonb, -- snapshot of payment status at scan time
  scanned_at timestamptz DEFAULT now(),
  override_used boolean DEFAULT false,
  override_reason text,
  device_type text, -- 'physical_scanner', 'camera', 'manual_entry'
  notes text
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scanner_logs_member_id ON scanner_access_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_scanner_logs_scanned_at ON scanner_access_logs(scanned_at);
CREATE INDEX IF NOT EXISTS idx_scanner_logs_access_granted ON scanner_access_logs(access_granted);
CREATE INDEX IF NOT EXISTS idx_scanner_logs_member_id_text ON scanner_access_logs(member_id_text);

-- Enable RLS
ALTER TABLE scanner_access_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scanner_access_logs
CREATE POLICY "Staff can view all scanner logs"
ON scanner_access_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE staff_profiles.user_id = auth.uid
  )
);

CREATE POLICY "Staff can create scanner logs"
ON scanner_access_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE staff_profiles.user_id = auth.uid
  )
  AND scanned_by = auth.uid
);

-- Create scanner_settings table
CREATE TABLE IF NOT EXISTS scanner_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_name text NOT NULL UNIQUE DEFAULT 'front_desk',
  auto_check_in_enabled boolean DEFAULT false,
  require_staff_confirmation boolean DEFAULT true,
  allow_override boolean DEFAULT true,
  audio_feedback_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default settings
INSERT INTO scanner_settings (location_name, auto_check_in_enabled, require_staff_confirmation, allow_override, audio_feedback_enabled)
VALUES ('front_desk', false, true, true, true)
ON CONFLICT (location_name) DO NOTHING;

-- Enable RLS
ALTER TABLE scanner_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scanner_settings
CREATE POLICY "Staff can view scanner settings"
ON scanner_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE staff_profiles.user_id = auth.uid
  )
);

CREATE POLICY "Admins can update scanner settings"
ON scanner_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE staff_profiles.user_id = auth.uid
    AND staff_profiles.role IN ('super_admin', 'admin', 'manager')
  )
);

-- Create trigger for updated_at on scanner_settings
CREATE OR REPLACE FUNCTION update_scanner_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scanner_settings_updated_at
BEFORE UPDATE ON scanner_settings
FOR EACH ROW
EXECUTE FUNCTION update_scanner_settings_updated_at();

-- RPC Function: process_member_scan()
-- Atomic operation for scan validation and check-in
CREATE OR REPLACE FUNCTION process_member_scan(
  p_member_id_text text,
  p_scanned_by uuid,
  p_auto_check_in boolean,
  p_device_type text,
  p_override boolean DEFAULT false,
  p_override_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member members%ROWTYPE;
  v_payment_status jsonb;
  v_access_granted boolean := false;
  v_denial_reason text;
  v_check_in_id uuid;
  v_log_id uuid;
BEGIN
  -- Lookup member by member_id text (STM-000001)
  SELECT * INTO v_member
  FROM members
  WHERE member_id = p_member_id_text;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'member_not_found',
      'message', 'Member ID not found'
    );
  END IF;
  
  -- Check membership status
  IF v_member.status IN ('expired', 'cancelled') THEN
    v_denial_reason := 'membership_' || v_member.status;
    v_access_granted := false;
  ELSIF v_member.status = 'frozen' THEN
    v_denial_reason := 'membership_frozen';
    v_access_granted := false;
  ELSE
    -- Check payment status
    SELECT jsonb_build_object(
      'isAnnualFeeOverdue', 
        CASE WHEN v_member.annual_fee_paid_at IS NULL 
          OR v_member.annual_fee_paid_at < now() - interval '1 year' 
        THEN true ELSE false END,
      'isDuesPastDue',
        CASE WHEN v_member.status = 'past_due' THEN true ELSE false END
    ) INTO v_payment_status;
    
    IF (v_payment_status->>'isAnnualFeeOverdue')::boolean 
       OR (v_payment_status->>'isDuesPastDue')::boolean THEN
      IF p_override THEN
        v_access_granted := true;
      ELSE
        v_denial_reason := 'payment_overdue';
        v_access_granted := false;
      END IF;
    ELSE
      v_access_granted := true;
    END IF;
  END IF;
  
  -- Auto check-in if enabled and access granted
  IF v_access_granted AND p_auto_check_in THEN
    INSERT INTO check_ins (member_id, checked_in_by, notes)
    VALUES (v_member.id, p_scanned_by, 'Auto check-in via scanner')
    RETURNING id INTO v_check_in_id;
  END IF;
  
  -- Log the scan attempt
  INSERT INTO scanner_access_logs (
    member_id,
    member_id_text,
    scanned_by,
    access_granted,
    access_denied_reason,
    auto_checked_in,
    check_in_id,
    payment_status,
    override_used,
    override_reason,
    device_type
  )
  VALUES (
    v_member.id,
    p_member_id_text,
    p_scanned_by,
    v_access_granted,
    v_denial_reason,
    p_auto_check_in AND v_access_granted,
    v_check_in_id,
    v_payment_status,
    p_override,
    p_override_reason,
    p_device_type
  )
  RETURNING id INTO v_log_id;
  
  -- Return result
  RETURN jsonb_build_object(
    'success', true,
    'access_granted', v_access_granted,
    'member', jsonb_build_object(
      'id', v_member.id,
      'member_id', v_member.member_id,
      'first_name', v_member.first_name,
      'last_name', v_member.last_name,
      'status', v_member.status,
      'membership_type', v_member.membership_type,
      'email', v_member.email
    ),
    'payment_status', v_payment_status,
    'denial_reason', v_denial_reason,
    'check_in_id', v_check_in_id,
    'log_id', v_log_id
  );
END;
$$;

-- Grant execute permission on RPC function
GRANT EXECUTE ON FUNCTION process_member_scan TO authenticated;

