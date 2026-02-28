
-- =============================================
-- REFERRAL REWARDS SYSTEM - DATABASE SCHEMA
-- =============================================

-- 1. Add referral_points_balance to members
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS referral_points_balance integer NOT NULL DEFAULT 0;

-- 2. Table: referral_codes
CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_referral_codes_member ON public.referral_codes(member_id);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own referral codes"
  ON public.referral_codes FOR SELECT
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Staff can manage all referral codes"
  ON public.referral_codes FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

-- 3. Table: member_referrals
CREATE TABLE public.member_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referring_member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  referred_email text NOT NULL,
  referred_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','signed_up','active','expired')),
  points_awarded integer NOT NULL DEFAULT 0,
  points_awarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_member_referrals_referring ON public.member_referrals(referring_member_id);
CREATE INDEX idx_member_referrals_email ON public.member_referrals(referred_email);

ALTER TABLE public.member_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own referrals"
  ON public.member_referrals FOR SELECT
  USING (referring_member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Members can insert own referrals"
  ON public.member_referrals FOR INSERT
  WITH CHECK (referring_member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Staff can manage all referrals"
  ON public.member_referrals FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

-- 4. Table: referral_point_transactions
CREATE TABLE public.referral_point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  points integer NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('referral_signup','milestone_bonus','redemption')),
  description text NOT NULL,
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_referral_points_member ON public.referral_point_transactions(member_id);

ALTER TABLE public.referral_point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own point transactions"
  ON public.referral_point_transactions FOR SELECT
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Staff can manage all point transactions"
  ON public.referral_point_transactions FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::app_role[]));

-- 5. Function: generate_referral_code
CREATE OR REPLACE FUNCTION public.generate_referral_code(_member_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code text;
  v_first_name text;
  v_suffix text;
  v_attempts integer := 0;
BEGIN
  -- Check if code already exists
  SELECT code INTO v_code FROM referral_codes WHERE member_id = _member_id;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;

  -- Build code from first name
  SELECT UPPER(SUBSTRING(first_name FROM 1 FOR 4)) INTO v_first_name FROM members WHERE id = _member_id;
  IF v_first_name IS NULL THEN v_first_name := 'MEMB'; END IF;

  LOOP
    v_suffix := LPAD(FLOOR(random() * 100)::text, 2, '0');
    v_code := 'STM-REF-' || v_first_name || v_suffix;
    
    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM referral_codes WHERE code = v_code) THEN
      INSERT INTO referral_codes (member_id, code) VALUES (_member_id, v_code);
      RETURN v_code;
    END IF;
    
    v_attempts := v_attempts + 1;
    IF v_attempts > 20 THEN
      -- Fallback to UUID-based suffix
      v_code := 'STM-REF-' || SUBSTRING(gen_random_uuid()::text FROM 1 FOR 8);
      INSERT INTO referral_codes (member_id, code) VALUES (_member_id, v_code);
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$;

-- 6. Function: award_referral_points
CREATE OR REPLACE FUNCTION public.award_referral_points(_referring_member_id uuid, _referred_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_referral_id uuid;
  v_successful_count integer;
BEGIN
  -- Find and update the referral record
  UPDATE member_referrals
  SET status = 'active',
      referred_member_id = _referred_member_id,
      points_awarded = 500,
      points_awarded_at = now(),
      updated_at = now()
  WHERE referring_member_id = _referring_member_id
    AND referred_member_id IS NULL
    AND referred_email = (SELECT LOWER(email) FROM members WHERE id = _referred_member_id)
    AND status IN ('pending', 'signed_up')
  RETURNING id INTO v_referral_id;

  IF v_referral_id IS NULL THEN RETURN; END IF;

  -- Award 500 points
  INSERT INTO referral_point_transactions (member_id, points, transaction_type, description, reference_id)
  VALUES (_referring_member_id, 500, 'referral_signup', 'Referral reward: new member signed up', v_referral_id);

  UPDATE members SET referral_points_balance = referral_points_balance + 500 WHERE id = _referring_member_id;

  -- Check milestones
  SELECT COUNT(*) INTO v_successful_count
  FROM member_referrals
  WHERE referring_member_id = _referring_member_id AND status = 'active';

  -- 3 referrals = 200 bonus
  IF v_successful_count = 3 THEN
    INSERT INTO referral_point_transactions (member_id, points, transaction_type, description)
    VALUES (_referring_member_id, 200, 'milestone_bonus', 'Milestone: 3 successful referrals');
    UPDATE members SET referral_points_balance = referral_points_balance + 200 WHERE id = _referring_member_id;
  END IF;

  -- 5 referrals = 500 bonus
  IF v_successful_count = 5 THEN
    INSERT INTO referral_point_transactions (member_id, points, transaction_type, description)
    VALUES (_referring_member_id, 500, 'milestone_bonus', 'Milestone: 5 successful referrals');
    UPDATE members SET referral_points_balance = referral_points_balance + 500 WHERE id = _referring_member_id;
  END IF;

  -- 10 referrals = 1000 bonus + Ambassador
  IF v_successful_count = 10 THEN
    INSERT INTO referral_point_transactions (member_id, points, transaction_type, description)
    VALUES (_referring_member_id, 1000, 'milestone_bonus', 'Milestone: 10 referrals — Ambassador status!');
    UPDATE members SET referral_points_balance = referral_points_balance + 1000 WHERE id = _referring_member_id;
  END IF;
END;
$$;

-- 7. Function: redeem_referral_points
CREATE OR REPLACE FUNCTION public.redeem_referral_points(_member_id uuid, _reward_type text, _points_cost integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance integer;
  v_user_id uuid;
  v_description text;
BEGIN
  -- Verify caller owns this member
  SELECT user_id INTO v_user_id FROM members WHERE id = _member_id;
  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Check balance
  SELECT referral_points_balance INTO v_balance FROM members WHERE id = _member_id FOR UPDATE;
  IF v_balance < _points_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient points');
  END IF;

  -- Determine reward description
  v_description := 'Redeemed: ' || _reward_type;

  -- Deduct points
  UPDATE members SET referral_points_balance = referral_points_balance - _points_cost WHERE id = _member_id;

  INSERT INTO referral_point_transactions (member_id, points, transaction_type, description)
  VALUES (_member_id, -_points_cost, 'redemption', v_description);

  -- Provision the reward based on type
  IF _reward_type = 'red_light_session' THEN
    INSERT INTO member_credits (member_id, user_id, credit_type, credits_remaining, credits_total, expires_at, source)
    VALUES (_member_id, v_user_id, 'red_light', 1, 1, now() + interval '90 days', 'referral_redemption');
  ELSIF _reward_type = 'dry_cryo_session' THEN
    INSERT INTO member_credits (member_id, user_id, credit_type, credits_remaining, credits_total, expires_at, source)
    VALUES (_member_id, v_user_id, 'dry_cryo', 1, 1, now() + interval '90 days', 'referral_redemption');
  ELSIF _reward_type = 'class_credit' THEN
    INSERT INTO member_credits (member_id, user_id, credit_type, credits_remaining, credits_total, expires_at, source)
    VALUES (_member_id, v_user_id, 'class', 1, 1, now() + interval '90 days', 'referral_redemption');
  ELSIF _reward_type = 'guest_pass' THEN
    INSERT INTO member_credits (member_id, user_id, credit_type, credits_remaining, credits_total, expires_at, source)
    VALUES (_member_id, v_user_id, 'guest_pass', 1, 1, now() + interval '90 days', 'referral_redemption');
  END IF;
  -- cafe_credit and spa_discount would be handled manually or via separate logic

  RETURN jsonb_build_object('success', true, 'new_balance', v_balance - _points_cost);
END;
$$;

-- 8. Trigger: auto-award points when member becomes active
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
    -- Find pending referral matching this member's email
    SELECT referring_member_id INTO v_referring_member_id
    FROM member_referrals
    WHERE LOWER(referred_email) = LOWER(NEW.email)
      AND status IN ('pending', 'signed_up')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_referring_member_id IS NOT NULL THEN
      PERFORM award_referral_points(v_referring_member_id, NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_referral_on_activation
  AFTER UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.check_referral_on_member_activation();
