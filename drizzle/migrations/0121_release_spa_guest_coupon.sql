CREATE OR REPLACE FUNCTION public.release_spa_guest_coupon(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c public.spa_guest_checkouts; r public.gift_card_redemptions;
BEGIN
 SELECT * INTO c FROM public.spa_guest_checkouts WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR c.status<>'payment_failed' OR c.appointment_id IS NULL OR c.coupon_kind IS NULL THEN RETURN; END IF;
 IF c.coupon_kind='mothers_day_voucher' THEN
   UPDATE public.mothers_day_vouchers SET status='active', redeemed_at=NULL, redeemed_appointment_id=NULL, redeemed_by_user_id=NULL
   WHERE redeemed_appointment_id=c.appointment_id AND status='redeemed';
 ELSE
   FOR r IN SELECT * FROM public.gift_card_redemptions WHERE applied_to_type='spa_appointment' AND applied_to_id=c.appointment_id FOR UPDATE LOOP
     UPDATE public.gift_cards SET balance_cents=balance_cents+r.amount_cents, status=CASE WHEN status='redeemed' THEN 'active' ELSE status END, updated_at=now() WHERE id=r.gift_card_id;
     DELETE FROM public.gift_card_redemptions WHERE id=r.id;
   END LOOP;
 END IF;
 UPDATE public.spa_guest_checkouts SET coupon_kind=NULL WHERE id=c.id;
END $function$;
REVOKE ALL ON FUNCTION public.release_spa_guest_coupon(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_spa_guest_coupon(uuid) TO service_role;