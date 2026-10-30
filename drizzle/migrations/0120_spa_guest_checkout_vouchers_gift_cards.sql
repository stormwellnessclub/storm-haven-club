ALTER TABLE public.spa_guest_checkouts
  ADD COLUMN IF NOT EXISTS coupon_kind text CHECK (coupon_kind IS NULL OR coupon_kind IN ('mothers_day_voucher','gift_card')),
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS covered_cents integer NOT NULL DEFAULT 0 CHECK (covered_cents >= 0),
  ADD COLUMN IF NOT EXISTS setup_intent_id text;

COMMENT ON COLUMN public.spa_guest_checkouts.covered_cents IS 'Service value covered by a Mother''s Day voucher or gift card; the card is charged only for the rest (or saved with no charge when nothing is due).';

CREATE OR REPLACE FUNCTION public.reserve_spa_guest_checkout(p_id uuid, p_intent text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c public.spa_guest_checkouts; s public.spa_services; a public.spa_service_availability; result uuid;
  v public.mothers_day_vouchers; g public.gift_cards; base_cents integer; card_cents integer; v_member uuid;
BEGIN
 SELECT * INTO c FROM public.spa_guest_checkouts WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR p_intent IS NULL OR p_intent IS DISTINCT FROM coalesce(c.payment_intent_id, c.setup_intent_id) THEN RAISE EXCEPTION 'Invalid checkout'; END IF;
 IF c.appointment_id IS NOT NULL THEN RETURN c.appointment_id; END IF;
 IF c.expires_at<now() OR c.status<>'pending' THEN RAISE EXCEPTION 'Checkout expired; please choose your time again'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('spa:'||c.appointment_date::text,0));
 SELECT * INTO s FROM public.spa_services WHERE id=c.service_id AND is_active;
 SELECT * INTO a FROM public.spa_service_availability WHERE id=c.availability_id AND is_active;
 IF s.id IS NULL OR a.id IS NULL OR a.service_id<>s.id OR (a.starts_on IS NOT NULL AND c.appointment_date<a.starts_on)
 OR (a.specific_date IS NOT NULL AND a.specific_date<>c.appointment_date)
 OR (a.specific_date IS NULL AND a.day_of_week<>extract(dow FROM c.appointment_date))
 OR c.appointment_time<a.start_time OR c.appointment_time+make_interval(mins=>c.duration_minutes+c.cleanup_minutes)>a.end_time
 OR c.appointment_date<(now() AT TIME ZONE 'America/Detroit')::date THEN RAISE EXCEPTION 'That time is no longer available'; END IF;
 IF EXISTS(SELECT 1 FROM public.spa_appointments b WHERE b.appointment_date=c.appointment_date AND b.status NOT IN ('cancelled','no_show')
 AND ((c.staff_id IS NOT NULL AND b.staff_id=c.staff_id) OR (c.room_id IS NOT NULL AND b.room_id=c.room_id))
 AND b.appointment_time<c.appointment_time+make_interval(mins=>c.duration_minutes+c.cleanup_minutes)
 AND c.appointment_time<b.appointment_time+make_interval(mins=>b.duration_minutes+b.cleanup_minutes)) THEN RAISE EXCEPTION 'That time is already booked'; END IF;

 base_cents := round(coalesce(c.member_price, c.service_price) * 100)::int;
 card_cents := greatest(0, base_cents - c.covered_cents);

 -- Lock and re-check the code inside the booking transaction so it can never be used twice.
 IF c.coupon_kind = 'mothers_day_voucher' THEN
   SELECT * INTO v FROM public.mothers_day_vouchers WHERE upper(code)=upper(c.coupon_code) FOR UPDATE;
   IF NOT FOUND OR v.status<>'active' OR v.expires_at<now() OR v.massage_duration IS DISTINCT FROM c.duration_minutes
     THEN RAISE EXCEPTION 'This voucher can no longer be used'; END IF;
 ELSIF c.coupon_kind = 'gift_card' THEN
   SELECT * INTO g FROM public.gift_cards WHERE upper(code)=upper(c.coupon_code) FOR UPDATE;
   IF NOT FOUND OR g.status IN ('void','pending','scheduled','redeemed') OR (g.expires_at IS NOT NULL AND g.expires_at<now()) OR g.balance_cents < c.covered_cents OR c.covered_cents<=0
     THEN RAISE EXCEPTION 'This gift card balance changed'; END IF;
 END IF;

 v_member := (SELECT id FROM public.members WHERE user_id=c.user_id AND status<>'cancelled' LIMIT 1);
 INSERT INTO public.spa_appointments(user_id,member_id,service_id,service_name,service_category,service_price,member_price,appointment_date,appointment_time,duration_minutes,cleanup_minutes,status,staff_id,room_id,guest_name,guest_email,guest_phone,member_notes,payment_method,payment_intent_id,amount_paid,created_via,covered_checkout)
 VALUES(c.user_id,v_member,s.id::text,s.name,s.category,c.service_price,c.member_price,c.appointment_date,c.appointment_time,c.duration_minutes,c.cleanup_minutes,'confirmed',c.staff_id,c.room_id,c.guest_name,c.guest_email,c.guest_phone,
   CASE WHEN c.coupon_kind IS NOT NULL THEN trim(both ' ' from coalesce(c.notes,'')||' [Paid with '||CASE WHEN c.coupon_kind='gift_card' THEN 'gift card ' ELSE 'Mother''s Day voucher ' END||c.coupon_code||']') ELSE c.notes END,
   coalesce(c.coupon_kind,'card'),c.payment_intent_id,0,'non_member_portal',
   CASE WHEN c.coupon_kind='gift_card' THEN jsonb_build_object('service_amount',base_cents/100.0,'amount_paid',0,'payment_method',NULL,'gift_card_code',c.coupon_code,'gift_card_amount',c.covered_cents/100.0,'card_amount',card_cents/100.0)
        WHEN c.coupon_kind='mothers_day_voucher' THEN jsonb_build_object('service_amount',base_cents/100.0,'amount_paid',0,'payment_method',NULL,'voucher_code',c.coupon_code)
        ELSE NULL END)
 RETURNING id INTO result;

 IF c.coupon_kind = 'mothers_day_voucher' THEN
   UPDATE public.mothers_day_vouchers SET status='redeemed', redeemed_at=now(), redeemed_appointment_id=result, redeemed_by_user_id=c.user_id WHERE id=v.id;
 ELSIF c.coupon_kind = 'gift_card' THEN
   UPDATE public.gift_cards SET balance_cents=g.balance_cents-c.covered_cents,
     status=CASE WHEN g.balance_cents-c.covered_cents=0 THEN 'redeemed' ELSE status END,
     first_redeemed_at=coalesce(first_redeemed_at,now()), updated_at=now() WHERE id=g.id;
   INSERT INTO public.gift_card_redemptions(gift_card_id,amount_cents,balance_after_cents,applied_to_type,applied_to_id,redeemed_by_user_id,redeemed_by_member_id,notes)
   VALUES(g.id,c.covered_cents,g.balance_cents-c.covered_cents,'spa_appointment',result,c.user_id,v_member,'Online spa booking: '||s.name);
 END IF;

 UPDATE public.spa_guest_checkouts SET appointment_id=result,status='reserved' WHERE id=c.id;
 RETURN result;
END $function$;

REVOKE ALL ON FUNCTION public.reserve_spa_guest_checkout(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_spa_guest_checkout(uuid,text) TO service_role;