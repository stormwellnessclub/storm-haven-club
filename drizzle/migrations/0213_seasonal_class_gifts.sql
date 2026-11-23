ALTER TABLE public.gift_card_offers ADD COLUMN IF NOT EXISTS class_offer_key text REFERENCES public.seasonal_class_offers(key);
ALTER TABLE public.gift_cards ADD COLUMN IF NOT EXISTS class_offer_key text REFERENCES public.seasonal_class_offers(key);
ALTER TABLE public.gift_cards ADD COLUMN IF NOT EXISTS redeemed_class_pass_id uuid;

INSERT INTO public.gift_card_offers (offer_key, label, blurb, price_cents, covers_service_ids, ends_at, is_active, display_order, class_offer_key)
SELECT 'gift_' || o.key, o.name,
  CASE o.key
    WHEN 'discovery_pass' THEN '3 group fitness classes · valid 21 days · for first-time class guests'
    WHEN 'movement_edit' THEN '10 group fitness classes · valid 2 months · for non-members'
    WHEN 'club_experience' THEN '10 group fitness classes + 1 club day pass · valid 2 months · for non-members'
  END,
  o.price_cents, '{}'::uuid[], o.ends_at, true, 100 + o.display_order, o.key
FROM public.seasonal_class_offers o
WHERE o.key IN ('discovery_pass','movement_edit','club_experience')
  AND NOT EXISTS (SELECT 1 FROM public.gift_card_offers g WHERE g.class_offer_key = o.key);

CREATE OR REPLACE FUNCTION public.guard_class_gift_balance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.class_offer_key IS NOT NULL AND NEW.balance_cents < OLD.balance_cents
     AND coalesce(current_setting('app.class_gift_redeem', true), '') <> 'on' THEN
    RAISE EXCEPTION 'This is a class gift. Redeem it on the Seasonal Edit page to add the classes.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_class_gift_balance ON public.gift_cards;
CREATE TRIGGER trg_guard_class_gift_balance BEFORE UPDATE OF balance_cents ON public.gift_cards
  FOR EACH ROW EXECUTE FUNCTION public.guard_class_gift_balance();

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
  INSERT INTO public.class_passes (user_id, category, pass_type, classes_total, classes_remaining, price_paid, is_member_price, expires_at, status, seasonal_offer_key, promo_code)
  VALUES (v_uid, 'pilates_cycling', o.name, o.classes, o.classes, 0, false, v_exp, 'active', o.key, 'seasonal_edit_gift')
  RETURNING id INTO v_pass;

  IF o.includes_day_pass THEN
    SELECT first_name, last_name, email, phone INTO p FROM public.profiles WHERE user_id = v_uid;
    INSERT INTO public.guest_passes (user_id, guest_name, guest_email, phone_number, price_paid, status, expires_at, payment_method, admin_notes)
    VALUES (v_uid, coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email, 'Guest'), coalesce(p.email, v_email), p.phone, 0, 'active', v_exp, 'seasonal_edit',
      'Complimentary club day pass — The Club Experience gift (The Seasonal Edit). Standard guest day-pass access only; no spa or separately priced recovery services. One redemption, non-transferable.')
    RETURNING id INTO v_gp;
    UPDATE public.class_passes SET day_pass_id = v_gp WHERE id = v_pass;
  END IF;

  PERFORM set_config('app.class_gift_redeem', 'on', true);
  UPDATE public.gift_cards SET balance_cents = 0, status = 'redeemed', redeemed_class_pass_id = v_pass,
    first_redeemed_at = coalesce(first_redeemed_at, now()), updated_at = now()
  WHERE id = c.id;
  PERFORM set_config('app.class_gift_redeem', 'off', true);

  RETURN jsonb_build_object('success', true, 'offer', o.name, 'classes', o.classes, 'expires_at', v_exp, 'day_pass', o.includes_day_pass);
END $$;
REVOKE ALL ON FUNCTION public.redeem_class_gift_card(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.redeem_class_gift_card(text) TO authenticated;