
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
  v_valid_costs jsonb := '{"red_light_session":1000,"dry_cryo_session":500,"class_credit":1000,"guest_pass":500,"cafe_credit":500}'::jsonb;
BEGIN
  -- Validate reward type exists
  IF NOT v_valid_costs ? _reward_type THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid reward type');
  END IF;

  -- Validate points cost matches expected cost
  IF _points_cost != (v_valid_costs->>_reward_type)::integer THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid points cost');
  END IF;

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
  -- cafe_credit handled manually by staff

  RETURN jsonb_build_object('success', true, 'new_balance', v_balance - _points_cost);
END;
$$;
