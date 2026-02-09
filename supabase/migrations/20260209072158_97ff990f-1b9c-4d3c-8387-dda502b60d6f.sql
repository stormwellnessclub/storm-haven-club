-- Add subscription_status column to members table
-- Tracks actual Stripe subscription status: none, incomplete, incomplete_expired, trialing, active, past_due, canceled, unpaid, paused
ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'none';

-- Update existing members based on their current state
UPDATE public.members 
SET subscription_status = CASE
  WHEN stripe_subscription_id IS NULL THEN 'none'
  WHEN status = 'active' AND stripe_subscription_id IS NOT NULL THEN 'active'
  WHEN status = 'past_due' THEN 'past_due'
  ELSE 'none'
END
WHERE subscription_status IS NULL OR subscription_status = 'none';

-- Add index for filtering by subscription status
CREATE INDEX IF NOT EXISTS idx_members_subscription_status 
ON public.members(subscription_status);

-- Update process_member_scan function to check subscription_status
CREATE OR REPLACE FUNCTION public.process_member_scan(p_scanned_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member RECORD;
  v_access_granted boolean := false;
  v_denial_reason text := null;
  v_check_in_id uuid := null;
  v_result jsonb;
BEGIN
  -- Look up member by entry token or member ID
  SELECT m.*, 
         et.expires_at as token_expires_at,
         et.is_revoked as token_revoked
  INTO v_member
  FROM members m
  LEFT JOIN entry_tokens et ON et.member_id = m.id AND et.token = p_scanned_code
  WHERE m.id::text = p_scanned_code 
     OR et.token = p_scanned_code;
  
  -- Member not found
  IF v_member IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'access_granted', false,
      'denial_reason', 'member_not_found',
      'message', 'No member found for this code'
    );
  END IF;
  
  -- Check member status
  IF v_member.status = 'active' THEN
    v_access_granted := true;
  ELSIF v_member.status = 'pending_activation' THEN
    v_access_granted := false;
    v_denial_reason := 'pending_activation';
  ELSIF v_member.status = 'frozen' THEN
    v_access_granted := false;
    v_denial_reason := 'frozen';
  ELSIF v_member.status = 'past_due' THEN
    v_access_granted := false;
    v_denial_reason := 'past_due';
  ELSIF v_member.status IN ('cancelled', 'inactive', 'expired') THEN
    v_access_granted := false;
    v_denial_reason := 'cancelled';
  ELSE
    v_access_granted := false;
    v_denial_reason := 'unknown_status';
  END IF;
  
  -- Check subscription_status - deny if subscription exists but is not active/trialing
  IF v_access_granted AND v_member.stripe_subscription_id IS NOT NULL THEN
    IF COALESCE(v_member.subscription_status, 'none') NOT IN ('active', 'trialing') THEN
      v_access_granted := false;
      v_denial_reason := 'payment_failed';
    END IF;
  END IF;
  
  -- Check token validity if using token
  IF v_access_granted AND v_member.token_expires_at IS NOT NULL THEN
    IF v_member.token_expires_at < now() THEN
      v_access_granted := false;
      v_denial_reason := 'token_expired';
    END IF;
    IF v_member.token_revoked = true THEN
      v_access_granted := false;
      v_denial_reason := 'token_revoked';
    END IF;
  END IF;
  
  -- If access granted, create check-in record
  IF v_access_granted THEN
    INSERT INTO check_ins (member_id, checked_in_at)
    VALUES (v_member.id, now())
    RETURNING id INTO v_check_in_id;
  END IF;
  
  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'access_granted', v_access_granted,
    'denial_reason', v_denial_reason,
    'check_in_id', v_check_in_id,
    'member', jsonb_build_object(
      'id', v_member.id,
      'first_name', v_member.first_name,
      'last_name', v_member.last_name,
      'email', v_member.email,
      'membership_type', v_member.membership_type,
      'status', v_member.status,
      'subscription_status', v_member.subscription_status,
      'photo_url', v_member.photo_url
    )
  );
  
  RETURN v_result;
END;
$$;