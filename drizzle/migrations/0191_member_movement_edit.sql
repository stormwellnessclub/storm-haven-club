ALTER TABLE public.seasonal_class_offers DROP CONSTRAINT IF EXISTS seasonal_class_offers_audience_check;
ALTER TABLE public.seasonal_class_offers ADD CONSTRAINT seasonal_class_offers_audience_check CHECK (audience IN ('any','non_member','member'));
ALTER TABLE public.seasonal_class_offers ADD COLUMN IF NOT EXISTS guest_class_credits integer NOT NULL DEFAULT 0;
ALTER TABLE public.seasonal_class_offers ADD COLUMN IF NOT EXISTS cafe_credit_cents integer NOT NULL DEFAULT 0;
INSERT INTO public.seasonal_class_offers (key,name,price_cents,classes,expiry_days,audience,first_time_only,includes_day_pass,guest_class_credits,cafe_credit_cents,ends_at,display_order)
VALUES ('member_movement_edit','The Member Movement Edit',16000,10,90,'member',false,false,1,1000,'2026-12-01 04:59:59+00',4)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seasonal_class_offer_block_reason(_user_id uuid, _email text, _key text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.seasonal_class_offers; v_email text := lower(trim(coalesce(_email,'')));
BEGIN
  SELECT * INTO o FROM public.seasonal_class_offers WHERE key = _key;
  IF NOT FOUND OR NOT o.is_active THEN RETURN 'This offer is not available right now.'; END IF;
  IF o.starts_at IS NOT NULL AND now() < o.starts_at THEN RETURN 'This offer has not started yet.'; END IF;
  IF o.ends_at IS NOT NULL AND now() > o.ends_at THEN RETURN 'This offer has ended.'; END IF;
  IF o.audience = 'non_member' AND EXISTS (
    SELECT 1 FROM public.members m
    WHERE (m.user_id = _user_id OR (v_email <> '' AND lower(m.email) = v_email))
      AND m.status NOT IN ('cancelled','expired')
  ) THEN RETURN 'This package is for non-members.'; END IF;
  IF o.audience = 'member' AND NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE (m.user_id = _user_id OR (v_email <> '' AND lower(m.email) = v_email))
      AND m.status = 'active'
  ) THEN RETURN 'This package is reserved for active members.'; END IF;
  IF o.first_time_only AND (
    EXISTS (SELECT 1 FROM public.class_passes p WHERE p.user_id = _user_id AND p.pass_type <> 'kids_care')
    OR EXISTS (SELECT 1 FROM public.class_bookings b WHERE b.user_id = _user_id OR (v_email <> '' AND lower(b.walk_in_email) = v_email))
  ) THEN RETURN 'The Discovery Pass is for first-time class guests.'; END IF;
  RETURN NULL;
END $$;

-- Guest class credits (bring a friend), separate from personal credits.
CREATE TABLE public.seasonal_guest_class_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id uuid NOT NULL REFERENCES public.class_passes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','redeemed')),
  booking_id uuid,
  guest_name text, guest_email text, guest_phone text,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX seasonal_guest_class_credits_one_per_pass ON public.seasonal_guest_class_credits(pass_id);
CREATE UNIQUE INDEX seasonal_guest_class_credits_booking_once ON public.seasonal_guest_class_credits(booking_id) WHERE booking_id IS NOT NULL;
GRANT SELECT ON public.seasonal_guest_class_credits TO authenticated;
GRANT ALL ON public.seasonal_guest_class_credits TO service_role;
ALTER TABLE public.seasonal_guest_class_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their guest credits" ON public.seasonal_guest_class_credits FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Staff read guest credits" ON public.seasonal_guest_class_credits FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]));

ALTER TABLE public.class_bookings ADD COLUMN IF NOT EXISTS guest_credit_id uuid;

CREATE OR REPLACE FUNCTION public.redeem_seasonal_guest_class_credit(_credit_id uuid, _session_id uuid, _guest_name text, _guest_email text, _guest_phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.seasonal_guest_class_credits; s public.class_sessions; v_email text := lower(trim(coalesce(_guest_email,''))); v_booking uuid; v_count int; v_start timestamptz;
BEGIN
  IF length(trim(coalesce(_guest_name,''))) < 2 OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(regexp_replace(coalesce(_guest_phone,''),'\D','','g')) < 10 THEN
    RETURN jsonb_build_object('success',false,'error','Please enter your friend''s name, email and phone.');
  END IF;
  SELECT * INTO c FROM public.seasonal_guest_class_credits WHERE id = _credit_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Guest credit not found.'); END IF;
  IF c.status <> 'available' THEN RETURN jsonb_build_object('success',false,'error','This guest credit has already been used.'); END IF;
  IF c.expires_at < now() THEN RETURN jsonb_build_object('success',false,'error','This guest credit has expired.'); END IF;
  IF v_email = lower(coalesce(public.current_user_email(),'')) THEN RETURN jsonb_build_object('success',false,'error','The guest credit is for a friend.'); END IF;
  IF EXISTS (SELECT 1 FROM public.members m WHERE lower(m.email) = v_email AND m.status NOT IN ('cancelled','expired')) THEN
    RETURN jsonb_build_object('success',false,'error','Your friend is already a member, so they can book with their membership.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.blocked_persons b WHERE lower(b.email) = v_email) THEN
    RETURN jsonb_build_object('success',false,'error','We can''t book this guest. Please contact the front desk.');
  END IF;
  SELECT * INTO s FROM public.class_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND OR s.is_cancelled OR s.is_hidden OR s.is_invite_only THEN RETURN jsonb_build_object('success',false,'error','This class isn''t available.'); END IF;
  v_start := ((s.session_date || ' ' || s.start_time)::timestamp AT TIME ZONE 'America/Detroit');
  IF v_start < now() THEN RETURN jsonb_build_object('success',false,'error','This class has already started.'); END IF;
  IF v_start > c.expires_at THEN RETURN jsonb_build_object('success',false,'error','This class is after your guest credit expires.'); END IF;
  SELECT count(*) INTO v_count FROM public.class_bookings WHERE session_id = s.id AND status IN ('confirmed','completed');
  IF v_count >= s.max_capacity THEN RETURN jsonb_build_object('success',false,'error','This class is full.'); END IF;
  IF EXISTS (SELECT 1 FROM public.class_bookings WHERE session_id = s.id AND status = 'confirmed' AND lower(walk_in_email) = v_email) THEN
    RETURN jsonb_build_object('success',false,'error','Your friend is already booked in this class.');
  END IF;
  INSERT INTO public.class_bookings(session_id, user_id, status, payment_method, credits_used, amount_paid, walk_in_name, walk_in_email, walk_in_phone, guest_credit_id)
  VALUES (s.id, NULL, 'confirmed', 'seasonal_guest_credit', 0, 0, trim(_guest_name), v_email, trim(_guest_phone), c.id)
  RETURNING id INTO v_booking;
  UPDATE public.seasonal_guest_class_credits SET status='redeemed', booking_id=v_booking, guest_name=trim(_guest_name), guest_email=v_email, guest_phone=trim(_guest_phone), redeemed_at=now() WHERE id=c.id;
  UPDATE public.class_sessions SET current_enrollment = v_count + 1, updated_at = now() WHERE id = s.id;
  RETURN jsonb_build_object('success',true,'booking_id',v_booking);
END $$;
REVOKE ALL ON FUNCTION public.redeem_seasonal_guest_class_credit(uuid,uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_seasonal_guest_class_credit(uuid,uuid,text,text,text) TO authenticated;

-- Member cancels the friend's spot: 24h+ before class returns the credit (same rule as classes).
CREATE OR REPLACE FUNCTION public.cancel_seasonal_guest_booking(_credit_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.seasonal_guest_class_credits; b public.class_bookings; s public.class_sessions; v_hours double precision; v_forfeit boolean;
BEGIN
  SELECT * INTO c FROM public.seasonal_guest_class_credits WHERE id=_credit_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND OR c.booking_id IS NULL THEN RETURN jsonb_build_object('success',false,'error','No booking to cancel.'); END IF;
  SELECT * INTO b FROM public.class_bookings WHERE id=c.booking_id AND status='confirmed' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','This booking is no longer active.'); END IF;
  SELECT * INTO s FROM public.class_sessions WHERE id=b.session_id;
  v_hours := EXTRACT(EPOCH FROM (((s.session_date || ' ' || s.start_time)::timestamp AT TIME ZONE 'America/Detroit') - now()))/3600.0;
  v_forfeit := v_hours < 24;
  UPDATE public.class_bookings SET status='cancelled', cancelled_at=now(), cancellation_reason = CASE WHEN v_forfeit THEN 'Late cancellation - guest credit forfeited' ELSE 'Member cancelled guest' END WHERE id=b.id;
  IF NOT v_forfeit THEN
    UPDATE public.seasonal_guest_class_credits SET status='available', booking_id=NULL, redeemed_at=NULL WHERE id=c.id;
  END IF;
  UPDATE public.class_sessions cs SET current_enrollment=(SELECT count(*) FROM public.class_bookings x WHERE x.session_id=cs.id AND x.status IN ('confirmed','completed')), updated_at=now() WHERE cs.id=s.id;
  RETURN jsonb_build_object('success',true,'forfeit_credit',v_forfeit);
END $$;
REVOKE ALL ON FUNCTION public.cancel_seasonal_guest_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_seasonal_guest_booking(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_seasonal_guest_credits()
RETURNS TABLE(id uuid, expires_at timestamptz, status text, guest_name text, booking_id uuid, booking_status text, class_name text, session_date date, start_time time)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.expires_at, c.status, c.guest_name, c.booking_id, b.status::text, ct.name, s.session_date, s.start_time
  FROM public.seasonal_guest_class_credits c
  LEFT JOIN public.class_bookings b ON b.id = c.booking_id
  LEFT JOIN public.class_sessions s ON s.id = b.session_id
  LEFT JOIN public.class_types ct ON ct.id = s.class_type_id
  WHERE c.user_id = auth.uid() ORDER BY c.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.my_seasonal_guest_credits() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_seasonal_guest_credits() TO authenticated;

-- Café credit expiry: grants with expires_at lose their unspent part after that date.
ALTER TABLE public.cafe_credit_ledger ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.cafe_credit_ledger ADD COLUMN IF NOT EXISTS expires_grant_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS cafe_credit_ledger_seasonal_grant_once ON public.cafe_credit_ledger(stripe_payment_intent_id) WHERE kind = 'seasonal_grant';
CREATE UNIQUE INDEX IF NOT EXISTS cafe_credit_ledger_expiry_once ON public.cafe_credit_ledger(expires_grant_id) WHERE expires_grant_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.cafe_pending_expiry_cents(_member_id uuid)
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE g record; v_bal bigint; v_later bigint; v_total bigint := 0; v_amt bigint;
BEGIN
  SELECT COALESCE(SUM(amount_cents),0) INTO v_bal FROM cafe_credit_ledger WHERE member_id=_member_id;
  FOR g IN SELECT * FROM cafe_credit_ledger l WHERE l.member_id=_member_id AND l.expires_at IS NOT NULL AND l.expires_at < now() AND l.amount_cents > 0
           AND NOT EXISTS (SELECT 1 FROM cafe_credit_ledger e WHERE e.expires_grant_id = l.id) ORDER BY l.created_at LOOP
    SELECT COALESCE(SUM(amount_cents),0) INTO v_later FROM cafe_credit_ledger WHERE member_id=_member_id AND amount_cents > 0 AND created_at > g.created_at;
    v_amt := LEAST(g.amount_cents, GREATEST(v_bal - v_total - v_later, 0));
    v_total := v_total + v_amt;
  END LOOP;
  RETURN v_total;
END $$;

CREATE OR REPLACE FUNCTION public.expire_cafe_credits(_member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record; v_bal bigint; v_later bigint; v_amt bigint;
BEGIN
  FOR g IN SELECT * FROM cafe_credit_ledger l WHERE l.member_id=_member_id AND l.expires_at IS NOT NULL AND l.expires_at < now() AND l.amount_cents > 0
           AND NOT EXISTS (SELECT 1 FROM cafe_credit_ledger e WHERE e.expires_grant_id = l.id) ORDER BY l.created_at FOR UPDATE LOOP
    SELECT COALESCE(SUM(amount_cents),0) INTO v_bal FROM cafe_credit_ledger WHERE member_id=_member_id;
    SELECT COALESCE(SUM(amount_cents),0) INTO v_later FROM cafe_credit_ledger WHERE member_id=_member_id AND amount_cents > 0 AND created_at > g.created_at;
    v_amt := LEAST(g.amount_cents, GREATEST(v_bal - v_later, 0));
    INSERT INTO cafe_credit_ledger(member_id, kind, amount_cents, reason, expires_grant_id)
    VALUES (_member_id, 'expiry', -v_amt, 'Expired: ' || coalesce(g.reason,'café credit'), g.id);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.expire_cafe_credits(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cafe_pending_expiry_cents(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_member_cafe_credit_balance(_member_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_balance bigint; v_items jsonb;
BEGIN
  SELECT COALESCE(SUM(amount_cents), 0) - public.cafe_pending_expiry_cents(_member_id) INTO v_balance
  FROM cafe_credit_ledger WHERE member_id = _member_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'menu_item_id', p.menu_item_id, 'quantity_remaining', p.quantity_remaining,
    'item_name', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', m.brand_name, m.item_name, m.flavor)), ''), 'Item'),
    'price', m.price
  )) FILTER (WHERE p.quantity_remaining > 0), '[]'::jsonb) INTO v_items
  FROM cafe_prepaid_items p LEFT JOIN cafe_menu_items m ON m.id = p.menu_item_id
  WHERE p.member_id = _member_id;
  RETURN jsonb_build_object('balance_cents', v_balance, 'prepaid_items', v_items);
END $function$;

-- Before any cash redemption, settle expired grants so expired credit can't be spent.
CREATE OR REPLACE FUNCTION public.cafe_ledger_expire_before_redeem()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bal bigint;
BEGIN
  IF NEW.kind = 'redemption_cash' THEN
    PERFORM public.expire_cafe_credits(NEW.member_id);
    SELECT COALESCE(SUM(amount_cents),0) INTO v_bal FROM cafe_credit_ledger WHERE member_id = NEW.member_id;
    IF -NEW.amount_cents > v_bal THEN
      RAISE EXCEPTION 'Café credit balance is lower than requested (some credit has expired). Please refresh.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cafe_ledger_expire_before_redeem ON public.cafe_credit_ledger;
CREATE TRIGGER cafe_ledger_expire_before_redeem BEFORE INSERT ON public.cafe_credit_ledger FOR EACH ROW EXECUTE FUNCTION public.cafe_ledger_expire_before_redeem();

-- Staff: extras per seasonal purchase.
CREATE OR REPLACE FUNCTION public.admin_seasonal_purchase_extras()
RETURNS TABLE(pass_id uuid, guest_status text, guest_name text, guest_class text, guest_class_date date, cafe_granted_cents int, cafe_expires_at timestamptz, cafe_member_balance_cents bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]) THEN RAISE EXCEPTION 'not allowed'; END IF;
  RETURN QUERY
  SELECT p.id, gc.status, gc.guest_name, ct.name, s.session_date, l.amount_cents, l.expires_at,
    CASE WHEN l.member_id IS NULL THEN NULL ELSE (SELECT COALESCE(SUM(x.amount_cents),0) FROM cafe_credit_ledger x WHERE x.member_id=l.member_id) - public.cafe_pending_expiry_cents(l.member_id) END
  FROM public.class_passes p
  LEFT JOIN public.seasonal_guest_class_credits gc ON gc.pass_id = p.id
  LEFT JOIN public.class_bookings b ON b.id = gc.booking_id
  LEFT JOIN public.class_sessions s ON s.id = b.session_id
  LEFT JOIN public.class_types ct ON ct.id = s.class_type_id
  LEFT JOIN public.cafe_credit_ledger l ON l.kind='seasonal_grant' AND l.stripe_payment_intent_id = p.stripe_payment_intent_id
  WHERE p.seasonal_offer_key = 'member_movement_edit';
END $$;
REVOKE ALL ON FUNCTION public.admin_seasonal_purchase_extras() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_seasonal_purchase_extras() TO authenticated;