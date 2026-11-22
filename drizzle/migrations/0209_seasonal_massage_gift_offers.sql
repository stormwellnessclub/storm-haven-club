-- Massage gifts: a gift card can pay for a whole listed massage, not just its dollar value.
ALTER TABLE public.gift_cards ADD COLUMN IF NOT EXISTS covers_service_ids uuid[];
ALTER TABLE public.gift_cards ADD COLUMN IF NOT EXISTS gift_offer_id uuid;

CREATE TABLE public.gift_card_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_key text NOT NULL UNIQUE,
  label text NOT NULL,
  blurb text,
  price_cents integer NOT NULL CHECK (price_cents BETWEEN 2500 AND 100000),
  covers_service_ids uuid[] NOT NULL DEFAULT '{}',
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gift_card_offers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gift_card_offers TO authenticated;
GRANT ALL ON public.gift_card_offers TO service_role;
ALTER TABLE public.gift_card_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can see gift offers on sale now" ON public.gift_card_offers
  FOR SELECT TO anon, authenticated
  USING (is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()));
CREATE POLICY "Managers can see all gift offers" ON public.gift_card_offers
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::public.app_role[]));
CREATE POLICY "Managers manage gift offers" ON public.gift_card_offers
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager']::public.app_role[]));

INSERT INTO public.gift_card_offers (offer_key, label, blurb, price_cents, covers_service_ids, starts_at, ends_at, display_order) VALUES
 ('seasonal_signature_deep_60', '60-Minute Massage — Storm Signature or Deep Relief', 'Covers a full 60-minute Storm Signature or Deep Relief massage', 12000,
   ARRAY['d3b11797-6c15-4f09-ab20-5a5fe0a5a1da','e8adef59-2a2a-4d50-b057-3bb92905b102']::uuid[], now(), '2026-12-01 04:59:59+00', 10),
 ('seasonal_signature_deep_90', '90-Minute Massage — Storm Signature or Deep Relief', 'Covers a full 90-minute Storm Signature or Deep Relief massage', 17000,
   ARRAY['8ae7af29-4972-4b65-ac28-db730c3e461d','65d5cf7e-acdd-4c77-97aa-0283d57c2dc4']::uuid[], now(), '2026-12-01 04:59:59+00', 20),
 ('seasonal_sports_60', '60-Minute Sports Performance Massage', 'Covers a full 60-minute Sports Performance massage', 16000,
   ARRAY['3c1d8893-c0af-4ace-81de-9cf7d13a3f98']::uuid[], now(), '2026-12-01 04:59:59+00', 30),
 ('seasonal_lymph_60', '60-Minute Lymph & Flow Massage', 'Covers a full 60-minute Lymph & Flow massage', 15000,
   ARRAY['933759dc-62ff-49d6-b68f-a74f9594f2bf']::uuid[], now(), '2026-12-01 04:59:59+00', 40),
 ('seasonal_sports_lymph_90', '90-Minute Massage — Sports Performance or Lymph & Flow', 'Covers a full 90-minute Sports Performance or Lymph & Flow massage', 18000,
   ARRAY['2f474b02-9b46-408d-a20d-518805bf0e92','acdbacfb-bdcc-4ad8-9712-0738bfc4187a']::uuid[], now(), '2026-12-01 04:59:59+00', 50),
 ('seasonal_prenatal_60', '60-Minute Prenatal Massage', 'Covers a full 60-minute Prenatal massage', 15000,
   ARRAY['b96dd3d3-f994-42be-a986-83f4c5965c21']::uuid[], now(), '2026-12-01 04:59:59+00', 60),
 ('seasonal_prenatal_90', '90-Minute Prenatal Massage', 'Covers a full 90-minute Prenatal massage', 19500,
   ARRAY['652cd6ad-5071-4ef4-8287-430d3b1eb440']::uuid[], now(), '2026-12-01 04:59:59+00', 70);

CREATE OR REPLACE FUNCTION public.reserve_spa_guest_checkout(p_id uuid, p_intent text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c public.spa_guest_checkouts; s public.spa_services; a public.spa_service_availability; result uuid;
  v public.mothers_day_vouchers; g public.gift_cards; base_cents integer; card_cents integer; v_member uuid;
  v_service_gift boolean := false; v_deduct integer := 0;
BEGIN
 SELECT * INTO c FROM public.spa_guest_checkouts WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR p_intent IS NULL OR p_intent IS DISTINCT FROM coalesce(c.payment_intent_id, c.setup_intent_id) THEN RAISE EXCEPTION 'Invalid checkout'; END IF;
 IF c.appointment_id IS NOT NULL THEN RETURN c.appointment_id; END IF;
 IF c.expires_at<now() OR c.status<>'pending' THEN RAISE EXCEPTION 'Checkout expired; please choose your time again'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('spa:'||c.appointment_date::text,0));
 SELECT * INTO s FROM public.spa_services WHERE id=c.service_id AND is_active;
 SELECT * INTO a FROM public.spa_service_availability WHERE id=c.availability_id AND is_active;
 -- The treatment must end within the window (same rule as the public time list); cleanup may run past it.
 IF s.id IS NULL OR a.id IS NULL OR a.service_id<>s.id OR (a.starts_on IS NOT NULL AND c.appointment_date<a.starts_on)
 OR (a.specific_date IS NOT NULL AND a.specific_date<>c.appointment_date)
 OR (a.specific_date IS NULL AND a.day_of_week<>extract(dow FROM c.appointment_date))
 OR c.appointment_time<a.start_time OR c.appointment_time+make_interval(mins=>c.duration_minutes)>a.end_time
 OR c.appointment_date<(now() AT TIME ZONE 'America/Detroit')::date THEN RAISE EXCEPTION 'That time is no longer available'; END IF;
 IF EXISTS(SELECT 1 FROM public.spa_appointments b WHERE b.appointment_date=c.appointment_date AND b.status NOT IN ('cancelled','no_show')
 AND ((c.staff_id IS NOT NULL AND b.staff_id=c.staff_id) OR (c.room_id IS NOT NULL AND b.room_id=c.room_id))
 AND b.appointment_time<c.appointment_time+make_interval(mins=>c.duration_minutes+c.cleanup_minutes)
 AND c.appointment_time<b.appointment_time+make_interval(mins=>b.duration_minutes+b.cleanup_minutes)) THEN RAISE EXCEPTION 'That time is already booked'; END IF;

 base_cents := round(coalesce(c.member_price, c.service_price) * 100)::int;
 card_cents := greatest(0, base_cents - c.covered_cents);

 IF c.coupon_kind = 'mothers_day_voucher' THEN
   SELECT * INTO v FROM public.mothers_day_vouchers WHERE upper(code)=upper(c.coupon_code) FOR UPDATE;
   IF NOT FOUND OR v.status<>'active' OR v.expires_at<now() OR v.massage_duration IS DISTINCT FROM c.duration_minutes
     THEN RAISE EXCEPTION 'This voucher can no longer be used'; END IF;
 ELSIF c.coupon_kind = 'gift_card' THEN
   SELECT * INTO g FROM public.gift_cards WHERE upper(code)=upper(c.coupon_code) FOR UPDATE;
   IF NOT FOUND OR g.status IN ('void','pending','scheduled','redeemed') OR (g.expires_at IS NOT NULL AND g.expires_at<now()) OR c.covered_cents<=0
     THEN RAISE EXCEPTION 'This gift card balance changed'; END IF;
   -- A massage gift (unused) pays for the whole listed treatment; the card's full value is used up.
   v_service_gift := g.covers_service_ids IS NOT NULL AND s.id = ANY(g.covers_service_ids)
     AND g.balance_cents = g.amount_cents AND c.duration_minutes = s.duration_minutes;
   IF v_service_gift THEN
     IF c.covered_cents <> base_cents THEN RAISE EXCEPTION 'This gift card balance changed'; END IF;
     v_deduct := g.balance_cents;
   ELSE
     IF g.balance_cents < c.covered_cents THEN RAISE EXCEPTION 'This gift card balance changed'; END IF;
     v_deduct := c.covered_cents;
   END IF;
 END IF;

 v_member := (SELECT id FROM public.members WHERE user_id=c.user_id AND status<>'cancelled' LIMIT 1);
 INSERT INTO public.spa_appointments(user_id,member_id,service_id,service_name,service_category,service_price,member_price,appointment_date,appointment_time,duration_minutes,cleanup_minutes,status,staff_id,room_id,guest_name,guest_email,guest_phone,member_notes,payment_method,payment_intent_id,amount_paid,created_via,covered_checkout)
 VALUES(c.user_id,v_member,s.id::text,s.name,s.category,c.service_price,c.member_price,c.appointment_date,c.appointment_time,c.duration_minutes,c.cleanup_minutes,'confirmed',c.staff_id,c.room_id,c.guest_name,c.guest_email,c.guest_phone,
   CASE WHEN c.coupon_kind IS NOT NULL THEN trim(both ' ' from coalesce(c.notes,'')||' [Paid with '||CASE WHEN c.coupon_kind='gift_card' THEN 'gift card ' ELSE 'Mother''s Day voucher ' END||c.coupon_code||']') ELSE c.notes END,
   coalesce(c.coupon_kind,'card'),c.payment_intent_id,0,'non_member_portal',
   CASE WHEN c.coupon_kind='gift_card' THEN jsonb_build_object('service_amount',base_cents/100.0,'amount_paid',0,'payment_method',NULL,'gift_card_code',c.coupon_code,'gift_card_amount',c.covered_cents/100.0,'gift_card_value',v_deduct/100.0,'massage_gift',v_service_gift,'card_amount',card_cents/100.0)
        WHEN c.coupon_kind='mothers_day_voucher' THEN jsonb_build_object('service_amount',base_cents/100.0,'amount_paid',0,'payment_method',NULL,'voucher_code',c.coupon_code)
        ELSE NULL END)
 RETURNING id INTO result;

 IF c.coupon_kind = 'mothers_day_voucher' THEN
   UPDATE public.mothers_day_vouchers SET status='redeemed', redeemed_at=now(), redeemed_appointment_id=result, redeemed_by_user_id=c.user_id WHERE id=v.id;
 ELSIF c.coupon_kind = 'gift_card' THEN
   UPDATE public.gift_cards SET balance_cents=g.balance_cents-v_deduct,
     status=CASE WHEN g.balance_cents-v_deduct=0 THEN 'redeemed' ELSE status END,
     first_redeemed_at=coalesce(first_redeemed_at,now()), updated_at=now() WHERE id=g.id;
   INSERT INTO public.gift_card_redemptions(gift_card_id,amount_cents,balance_after_cents,applied_to_type,applied_to_id,redeemed_by_user_id,redeemed_by_member_id,notes)
   VALUES(g.id,v_deduct,g.balance_cents-v_deduct,'spa_appointment',result,c.user_id,v_member,
     'Online spa booking: '||s.name||CASE WHEN v_service_gift THEN ' (massage gift covers the full treatment)' ELSE '' END);
 END IF;

 UPDATE public.spa_guest_checkouts SET appointment_id=result,status='reserved' WHERE id=c.id;
 RETURN result;
END $function$;