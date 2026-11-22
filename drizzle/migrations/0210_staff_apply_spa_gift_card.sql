CREATE OR REPLACE FUNCTION public.staff_apply_spa_gift_card(p_appointment_id uuid, p_code text, p_apply boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ap public.spa_appointments%ROWTYPE;
  g public.gift_cards%ROWTYPE;
  s public.spa_services%ROWTYPE;
  v_base int;
  v_cover int;
  v_deduct int;
  v_gift boolean := false;
  v_code text := upper(btrim(coalesce(p_code, '')));
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk','spa_staff']::app_role[]) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only staff can apply gift cards.');
  END IF;
  IF v_code = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'Enter a gift card code.'); END IF;

  SELECT * INTO ap FROM public.spa_appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Appointment not found.'); END IF;
  IF ap.status IN ('cancelled','no_show') THEN RETURN jsonb_build_object('ok', false, 'error', 'This appointment was cancelled.'); END IF;
  IF ap.payment_method IN ('gift_card','mothers_day_voucher','credit','spa_package') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This appointment is already covered.');
  END IF;
  IF coalesce(ap.amount_paid, 0) > 0 AND (ap.payment_intent_id IS NOT NULL OR ap.payment_method IN ('cash','check','other')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A payment is already recorded for this appointment.');
  END IF;

  SELECT * INTO g FROM public.gift_cards WHERE upper(code) = v_code FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'That gift card code was not found.'); END IF;
  IF g.status = 'void' THEN RETURN jsonb_build_object('ok', false, 'error', 'This gift card was cancelled.'); END IF;
  IF g.status IN ('pending','scheduled') THEN RETURN jsonb_build_object('ok', false, 'error', 'This gift card is not active yet.'); END IF;
  IF g.status = 'redeemed' OR g.balance_cents <= 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'This gift card has already been used.'); END IF;
  IF g.expires_at IS NOT NULL AND g.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'error', 'This gift card has expired.'); END IF;

  SELECT * INTO s FROM public.spa_services WHERE id::text = ap.service_id;
  v_base := round(coalesce(ap.member_price, ap.service_price, 0) * 100)::int;
  IF v_base <= 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'This appointment has no price to cover.'); END IF;

  -- Same rule as online booking: an unused massage gift pays for its listed massage at normal length in full.
  v_gift := g.covers_service_ids IS NOT NULL AND ap.service_id = ANY(g.covers_service_ids::text[])
    AND g.amount_cents IS NOT NULL AND g.balance_cents = g.amount_cents
    AND s.id IS NOT NULL AND ap.duration_minutes = s.duration_minutes;
  IF v_gift THEN
    v_cover := v_base;
    v_deduct := g.balance_cents;
  ELSE
    v_cover := LEAST(g.balance_cents, v_base);
    v_deduct := v_cover;
  END IF;

  IF p_apply THEN
    UPDATE public.spa_appointments SET
      payment_method = 'gift_card',
      amount_paid = 0,
      covered_checkout = jsonb_build_object('service_amount', v_cover/100.0, 'amount_paid', 0, 'payment_method', NULL,
        'gift_card_code', g.code, 'gift_card_amount', v_cover/100.0, 'gift_card_value', v_deduct/100.0,
        'massage_gift', v_gift, 'applied_by_staff', auth.uid()),
      staff_notes = trim(both E'\n' from coalesce(staff_notes, '') || E'\n' || '[Paid with gift card ' || g.code || ']'),
      updated_at = now()
    WHERE id = ap.id;

    UPDATE public.gift_cards SET balance_cents = g.balance_cents - v_deduct,
      status = CASE WHEN g.balance_cents - v_deduct = 0 THEN 'redeemed' ELSE status END,
      first_redeemed_at = coalesce(first_redeemed_at, now()), updated_at = now()
    WHERE id = g.id;

    INSERT INTO public.gift_card_redemptions(gift_card_id, amount_cents, balance_after_cents, applied_to_type, applied_to_id, redeemed_by_user_id, notes)
    VALUES (g.id, v_deduct, g.balance_cents - v_deduct, 'spa_appointment', ap.id, auth.uid(),
      'Front desk spa checkout: ' || coalesce(ap.service_name, 'spa service') || CASE WHEN v_gift THEN ' (massage gift covers the full treatment)' ELSE '' END);
  END IF;

  RETURN jsonb_build_object('ok', true, 'applied', p_apply, 'code', g.code, 'massage_gift', v_gift,
    'service_price', v_base/100.0, 'covered', v_cover/100.0, 'still_due', (v_base - v_cover)/100.0,
    'balance_after', (g.balance_cents - v_deduct)/100.0, 'recipient_name', g.recipient_name);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_apply_spa_gift_card(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_apply_spa_gift_card(uuid, text, boolean) TO authenticated, service_role;