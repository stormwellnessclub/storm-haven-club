CREATE OR REPLACE FUNCTION public.guard_members_self_activation_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed text[];
  col text;
  allowed constant text[] := ARRAY['status','activated_at','membership_start_date','updated_at'];
BEGIN
  IF public.is_privileged_row_writer() THEN
    RETURN NEW;
  END IF;

  changed := public.changed_columns(to_jsonb(OLD), to_jsonb(NEW));
  FOREACH col IN ARRAY changed LOOP
    IF NOT (col = ANY(allowed)) THEN
      RAISE EXCEPTION 'Not allowed to change % while activating membership', col USING ERRCODE = '42501';
    END IF;
  END LOOP;

  IF OLD.status IS DISTINCT FROM 'pending_activation' OR NEW.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Only pending memberships can be activated' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_members_self_activation_update ON public.members;
CREATE TRIGGER trg_guard_members_self_activation_update
BEFORE UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.guard_members_self_activation_update();

CREATE OR REPLACE FUNCTION public.guard_spa_appointments_member_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed text[];
  col text;
  allowed constant text[] := ARRAY['status','cancelled_at','cancellation_reason','member_notes','updated_at'];
BEGIN
  IF public.is_privileged_row_writer() THEN
    RETURN NEW;
  END IF;

  changed := public.changed_columns(to_jsonb(OLD), to_jsonb(NEW));
  FOREACH col IN ARRAY changed LOOP
    IF NOT (col = ANY(allowed)) THEN
      RAISE EXCEPTION 'Not allowed to change % on your spa appointment', col USING ERRCODE = '42501';
    END IF;
  END LOOP;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IS DISTINCT FROM 'cancelled' THEN
    RAISE EXCEPTION 'You may only cancel your spa appointment' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_spa_appointments_member_update ON public.spa_appointments;
CREATE TRIGGER trg_guard_spa_appointments_member_update
BEFORE UPDATE ON public.spa_appointments
FOR EACH ROW EXECUTE FUNCTION public.guard_spa_appointments_member_update();

CREATE OR REPLACE FUNCTION public.guard_cafe_orders_member_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed text[];
  col text;
  allowed constant text[] := ARRAY['status','updated_at'];
BEGIN
  IF public.is_privileged_row_writer() THEN
    RETURN NEW;
  END IF;

  changed := public.changed_columns(to_jsonb(OLD), to_jsonb(NEW));
  FOREACH col IN ARRAY changed LOOP
    IF NOT (col = ANY(allowed)) THEN
      RAISE EXCEPTION 'Not allowed to change % on your cafe order', col USING ERRCODE = '42501';
    END IF;
  END LOOP;

  IF OLD.status IS DISTINCT FROM 'pending' OR NEW.status IS DISTINCT FROM 'cancelled' THEN
    RAISE EXCEPTION 'You may only cancel a pending cafe order' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_cafe_orders_member_update ON public.cafe_orders;
CREATE TRIGGER trg_guard_cafe_orders_member_update
BEFORE UPDATE ON public.cafe_orders
FOR EACH ROW EXECUTE FUNCTION public.guard_cafe_orders_member_update();

DROP POLICY IF EXISTS "Recipients view gifted vouchers" ON public.mothers_day_vouchers;
DROP POLICY IF EXISTS "Users can view their own mothers day vouchers" ON public.mothers_day_vouchers;

CREATE OR REPLACE FUNCTION public.get_my_mothers_day_vouchers()
RETURNS TABLE(
  id uuid,
  code text,
  status mothers_day_voucher_status,
  buyer_user_id uuid,
  buyer_name text,
  buyer_email text,
  recipient_name text,
  recipient_email text,
  massage_choice text,
  massage_duration integer,
  expires_at timestamptz,
  amount_paid_cents integer,
  purchased_at timestamptz,
  is_gift_to_me boolean,
  is_purchaser boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id,
    v.code,
    v.status,
    v.buyer_user_id,
    v.buyer_name,
    CASE WHEN v.buyer_user_id = auth.uid() OR lower(v.buyer_email) = public.current_user_email_lower() THEN v.buyer_email ELSE NULL END,
    v.recipient_name,
    CASE WHEN v.buyer_user_id = auth.uid() OR lower(v.buyer_email) = public.current_user_email_lower() THEN v.recipient_email ELSE public.current_user_email_lower() END,
    v.massage_choice,
    v.massage_duration,
    v.expires_at,
    CASE WHEN v.buyer_user_id = auth.uid() OR lower(v.buyer_email) = public.current_user_email_lower() THEN v.amount_paid_cents ELSE NULL END,
    v.purchased_at,
    lower(COALESCE(v.recipient_email, '')) = public.current_user_email_lower(),
    v.buyer_user_id = auth.uid() OR lower(v.buyer_email) = public.current_user_email_lower()
  FROM public.mothers_day_vouchers v
  WHERE auth.uid() IS NOT NULL
    AND (
      v.buyer_user_id = auth.uid()
      OR lower(v.buyer_email) = public.current_user_email_lower()
      OR lower(COALESCE(v.recipient_email, '')) = public.current_user_email_lower()
    )
  ORDER BY v.purchased_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_my_mothers_day_vouchers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_mothers_day_vouchers() TO authenticated, service_role;

DROP POLICY IF EXISTS "Anyone can view kids care hour slots" ON public.kids_care_hour_slots;
DROP POLICY IF EXISTS "Public can view kids care hour slots" ON public.kids_care_hour_slots;
REVOKE SELECT ON public.kids_care_hour_slots FROM anon, authenticated;
DROP VIEW IF EXISTS public.kids_care_hour_slots_public;

CREATE OR REPLACE FUNCTION public.get_public_kids_care_hour_slots(p_start date, p_end date)
RETURNS TABLE(id uuid, slot_date date, open_time time, close_time time, label text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.slot_date, s.open_time, s.close_time, s.label
  FROM public.kids_care_hour_slots s
  WHERE s.slot_date >= p_start AND s.slot_date <= p_end
  ORDER BY s.slot_date, s.open_time;
$$;
REVOKE ALL ON FUNCTION public.get_public_kids_care_hour_slots(date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_kids_care_hour_slots(date,date) TO anon, authenticated, service_role;