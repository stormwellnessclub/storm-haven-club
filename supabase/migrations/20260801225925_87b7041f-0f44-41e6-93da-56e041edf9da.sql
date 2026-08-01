
CREATE OR REPLACE FUNCTION public.guard_member_field_tamper()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  protected_cols text[] := TG_ARGV[0]::text[];
  col text;
  old_j jsonb := to_jsonb(OLD);
  new_j jsonb := to_jsonb(NEW);
BEGIN
  -- Only enforce for direct API calls made by end users (PostgREST roles).
  -- SECURITY DEFINER RPCs and service-role/internal jobs run as another role and are exempt.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- Staff are exempt (they have explicit staff policies).
  IF public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk','spa_staff','cafe_staff','class_instructor','childcare_staff']::app_role[]) THEN
    RETURN NEW;
  END IF;

  FOREACH col IN ARRAY protected_cols LOOP
    IF (old_j -> col) IS DISTINCT FROM (new_j -> col) THEN
      RAISE EXCEPTION 'Not allowed to modify %.% ', TG_TABLE_NAME, col
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  -- Status may only be moved to a cancelled state by the owner.
  IF (old_j ? 'status') AND (old_j -> 'status') IS DISTINCT FROM (new_j -> 'status') THEN
    IF COALESCE(new_j ->> 'status', '') NOT IN ('cancelled', 'canceled') THEN
      RAISE EXCEPTION 'Not allowed to set %.status to %', TG_TABLE_NAME, new_j ->> 'status'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_member_field_tamper() FROM PUBLIC;

DROP TRIGGER IF EXISTS guard_member_tamper_class_bookings ON public.class_bookings;
CREATE TRIGGER guard_member_tamper_class_bookings
BEFORE UPDATE ON public.class_bookings
FOR EACH ROW EXECUTE FUNCTION public.guard_member_field_tamper(
  '{user_id,member_id,session_id,pass_id,member_credit_id,credits_used,amount_paid,payment_method,checked_in_at,is_admin_hold,booked_at}');

DROP TRIGGER IF EXISTS guard_member_tamper_class_passes ON public.class_passes;
CREATE TRIGGER guard_member_tamper_class_passes
BEFORE UPDATE ON public.class_passes
FOR EACH ROW EXECUTE FUNCTION public.guard_member_field_tamper(
  '{user_id,member_id,pass_type,category,classes_total,classes_remaining,price_paid,is_member_price,purchased_at,expires_at,promo_code,gift_verification_status,stripe_payment_intent_id}');

DROP TRIGGER IF EXISTS guard_member_tamper_class_waitlist ON public.class_waitlist;
CREATE TRIGGER guard_member_tamper_class_waitlist
BEFORE UPDATE ON public.class_waitlist
FOR EACH ROW EXECUTE FUNCTION public.guard_member_field_tamper(
  '{user_id,session_id,position,pass_id,member_credit_id,credits_used,payment_method,notified_at,claim_expires_at,claimed_at,hold_refunded,refunded_at}');

DROP TRIGGER IF EXISTS guard_member_tamper_cafe_orders ON public.cafe_orders;
CREATE TRIGGER guard_member_tamper_cafe_orders
BEFORE UPDATE ON public.cafe_orders
FOR EACH ROW EXECUTE FUNCTION public.guard_member_field_tamper(
  '{user_id,member_id,order_items,total_amount,payment_method,payment_intent_id,estimated_ready_at,completed_at}');

DROP TRIGGER IF EXISTS guard_member_tamper_spa_appointments ON public.spa_appointments;
CREATE TRIGGER guard_member_tamper_spa_appointments
BEFORE UPDATE ON public.spa_appointments
FOR EACH ROW EXECUTE FUNCTION public.guard_member_field_tamper(
  '{user_id,member_id,service_id,service_price,member_price,staff_id,staff_notes,payment_method,payment_intent_id,amount_paid,tip_amount,tip_payment_method,addons,addons_total,credit_id,credit_type,checked_in_at,completed_at,room_id}');
