
-- Add name columns to member_referrals
ALTER TABLE public.member_referrals
  ADD COLUMN IF NOT EXISTS referred_first_name text,
  ADD COLUMN IF NOT EXISTS referred_last_name text;

-- Add referred_by_code to members for referral code tracking
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS referred_by_code text;

-- Update activation trigger to match by email OR referral code
CREATE OR REPLACE FUNCTION public.check_referral_on_member_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_referring_member_id uuid;
BEGIN
  -- Only fire when status changes TO 'active'
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    -- Find pending referral matching by email
    SELECT referring_member_id INTO v_referring_member_id
    FROM member_referrals
    WHERE LOWER(referred_email) = LOWER(NEW.email)
      AND status IN ('pending', 'signed_up')
    ORDER BY created_at DESC
    LIMIT 1;

    -- Fallback: match by referral code if no email match
    IF v_referring_member_id IS NULL AND NEW.referred_by_code IS NOT NULL THEN
      SELECT rc.member_id INTO v_referring_member_id
      FROM referral_codes rc
      JOIN member_referrals mr ON mr.referring_member_id = rc.member_id
      WHERE rc.code = NEW.referred_by_code
        AND mr.status IN ('pending', 'signed_up')
      ORDER BY mr.created_at DESC
      LIMIT 1;
    END IF;

    IF v_referring_member_id IS NOT NULL THEN
      PERFORM award_referral_points(v_referring_member_id, NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
