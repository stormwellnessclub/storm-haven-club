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

    -- Guard: only award points if member is genuinely paying
    -- Must have subscription_status = 'active' with a valid stripe subscription,
    -- OR be a founding member
    IF NOT (
      (NEW.subscription_status = 'active' AND NEW.stripe_subscription_id IS NOT NULL)
      OR NEW.is_founding_member = true
    ) THEN
      RETURN NEW; -- Not yet paid, skip awarding
    END IF;

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