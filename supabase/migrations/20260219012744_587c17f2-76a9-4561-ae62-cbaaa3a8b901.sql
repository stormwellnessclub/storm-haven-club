
-- Add referring_member_id to guest_passes
ALTER TABLE public.guest_passes ADD COLUMN referring_member_id UUID REFERENCES public.members(id);

-- Create atomic RPC for redeeming guest pass credit
CREATE OR REPLACE FUNCTION public.redeem_guest_pass_credit(
  p_guest_first_name TEXT,
  p_guest_last_name TEXT,
  p_guest_email TEXT,
  p_guest_phone TEXT,
  p_visit_date DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_member RECORD;
  v_credit RECORD;
  v_guest_pass_id UUID;
  v_full_name TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get the member record
  SELECT id, first_name, last_name INTO v_member
  FROM public.members
  WHERE user_id = v_user_id AND status = 'active'
  LIMIT 1;

  IF v_member.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active membership found');
  END IF;

  -- Find and lock a guest_pass credit with remaining > 0
  SELECT * INTO v_credit
  FROM public.member_credits
  WHERE member_id = v_member.id
    AND credit_type = 'guest_pass'
    AND credits_remaining > 0
    AND expires_at > now()
  ORDER BY expires_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_credit.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No guest pass credits available');
  END IF;

  v_full_name := TRIM(p_guest_first_name) || ' ' || TRIM(p_guest_last_name);

  -- Deduct the credit
  UPDATE public.member_credits
  SET credits_remaining = credits_remaining - 1
  WHERE id = v_credit.id;

  -- Create the guest pass
  INSERT INTO public.guest_passes (
    guest_name, guest_email, phone_number, valid_date,
    price_paid, status, user_id, member_referral,
    expires_at, referring_member_id
  ) VALUES (
    v_full_name, TRIM(p_guest_email), TRIM(p_guest_phone), p_visit_date,
    0, 'active', v_user_id,
    v_member.first_name || ' ' || v_member.last_name || ' (Complimentary)',
    (p_visit_date::text || 'T23:59:59')::timestamptz,
    v_member.id
  )
  RETURNING id INTO v_guest_pass_id;

  RETURN jsonb_build_object(
    'success', true,
    'guest_pass_id', v_guest_pass_id,
    'credits_remaining', v_credit.credits_remaining - 1
  );
END;
$$;
