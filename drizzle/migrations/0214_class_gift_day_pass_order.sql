CREATE OR REPLACE FUNCTION public.redeem_class_gift_card(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  c public.gift_cards;
  o public.seasonal_class_offers;
  v_pass uuid;
  v_exp timestamptz;
  v_gp uuid;
  p record;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Please sign in to redeem your gift.'); END IF;
  SELECT * INTO c FROM public.gift_cards WHERE upper(code) = upper(trim(_code)) FOR UPDATE;
  IF NOT FOUND OR c.class_offer_key IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'That code isn''t a class gift. Check the code in your gift email.'); END IF;
  IF c.redeemed_class_pass_id IS NOT NULL OR c.status = 'redeemed' THEN RETURN jsonb_build_object('success', false, 'error', 'This gift has already been redeemed.'); END IF;
  IF c.status <> 'active' THEN RETURN jsonb_build_object('success', false, 'error', 'This gift isn''t ready to redeem yet.'); END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN RETURN jsonb_build_object('success', false, 'error', 'This gift has expired.'); END IF;
  SELECT * INTO o FROM public.seasonal_class_offers WHERE key = c.class_offer_key;
  IF o.audience = 'non_member' AND EXISTS (SELECT 1 FROM public.members m WHERE m.user_id = v_uid AND m.status NOT IN ('cancelled','expired')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This class gift is for non-members. Please contact us and we''ll help.');
  END IF;
  IF o.first_time_only AND (
    EXISTS (SELECT 1 FROM public.class_passes x WHERE x.user_id = v_uid AND x.pass_type <> 'kids_care')
    OR EXISTS (SELECT 1 FROM public.class_bookings b WHERE b.user_id = v_uid)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'The Discovery Pass is for first-time class guests. Please contact us and we''ll help.');
  END IF;

  v_exp := now() + make_interval(days => o.expiry_days);
  IF o.includes_day_pass THEN
    SELECT first_name, last_name, email, phone INTO p FROM public.profiles WHERE user_id = v_uid;
    INSERT INTO public.guest_passes (user_id, guest_name, guest_email, phone_number, price_paid, status, expires_at, payment_method, admin_notes)
    VALUES (v_uid, coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email, 'Guest'), coalesce(p.email, v_email), p.phone, 0, 'active', v_exp, 'seasonal_edit',
      'Complimentary club day pass — The Club Experience gift (The Seasonal Edit). Standard guest day-pass access only; no spa or separately priced recovery services. One redemption, non-transferable.')
    RETURNING id INTO v_gp;
  END IF;

  INSERT INTO public.class_passes (user_id, category, pass_type, classes_total, classes_remaining, price_paid, is_member_price, expires_at, status, seasonal_offer_key, promo_code, day_pass_id)
  VALUES (v_uid, 'pilates_cycling', o.name, o.classes, o.classes, 0, false, v_exp, 'active', o.key, 'seasonal_edit_gift', v_gp)
  RETURNING id INTO v_pass;

  PERFORM set_config('app.class_gift_redeem', 'on', true);
  UPDATE public.gift_cards SET balance_cents = 0, status = 'redeemed', redeemed_class_pass_id = v_pass,
    first_redeemed_at = coalesce(first_redeemed_at, now()), updated_at = now()
  WHERE id = c.id;
  PERFORM set_config('app.class_gift_redeem', 'off', true);

  RETURN jsonb_build_object('success', true, 'offer', o.name, 'classes', o.classes, 'expires_at', v_exp, 'day_pass', o.includes_day_pass);
END $$;
REVOKE ALL ON FUNCTION public.redeem_class_gift_card(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.redeem_class_gift_card(text) TO authenticated;

UPDATE public.gift_card_offers SET blurb = NULL WHERE class_offer_key IS NULL AND blurb ILIKE 'Covers a full%';