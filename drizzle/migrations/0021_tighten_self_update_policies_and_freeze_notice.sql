-- 1. Fix mutable search_path
ALTER FUNCTION public.changed_columns(jsonb, jsonb) SET search_path = public, pg_temp;

-- 2. Kids care bookings: guard financial/scheduling fields on member self-updates
DROP TRIGGER IF EXISTS guard_member_tamper_kids_care_bookings ON public.kids_care_bookings;
CREATE TRIGGER guard_member_tamper_kids_care_bookings
BEFORE UPDATE ON public.kids_care_bookings
FOR EACH ROW EXECUTE FUNCTION public.guard_member_field_tamper(
  '{user_id,member_id,pass_id,child_name,child_age,child_dob,booking_date,start_time,end_time,age_group,room,checked_in_at,checked_out_at,checked_in_by,checked_out_by}'
);

DROP POLICY IF EXISTS "Users can update their own kids care bookings" ON public.kids_care_bookings;
CREATE POLICY "Users can update their own kids care bookings"
ON public.kids_care_bookings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = ANY (ARRAY['confirmed','pending']))
WITH CHECK (
  auth.uid() = user_id
  AND status = ANY (ARRAY['confirmed','pending','cancelled'])
);

-- 3. Cafe orders: pin ownership and allowed statuses on self-update
DROP POLICY IF EXISTS "Users can update their own pending orders" ON public.cafe_orders;
CREATE POLICY "Users can update their own pending orders"
ON public.cafe_orders
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status = ANY (ARRAY['pending','cancelled']));

-- 4. Class bookings: pin ownership on self-update
DROP POLICY IF EXISTS "Users can update their own bookings" ON public.class_bookings;
CREATE POLICY "Users can update their own bookings"
ON public.class_bookings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Class waitlist: pin ownership on self-update
DROP POLICY IF EXISTS "Users can update their own waitlist entries" ON public.class_waitlist;
CREATE POLICY "Users can update their own waitlist entries"
ON public.class_waitlist
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. Freeze requests require 14 days notice for member-created requests
CREATE OR REPLACE FUNCTION public.enforce_freeze_request_notice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Detroit')::date;
BEGIN
  -- Internal jobs / SECURITY DEFINER RPCs run as another role and are exempt.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- Staff may book freezes with shorter notice.
  IF public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','front_desk']::app_role[]) THEN
    RETURN NEW;
  END IF;

  IF NEW.requested_start_date IS NOT NULL AND NEW.requested_start_date < (v_today + 14) THEN
    RAISE EXCEPTION 'FREEZE_NOTICE_REQUIRED: Freeze requests must be submitted at least 14 days before the start date.'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_freeze_request_notice ON public.member_freezes;
CREATE TRIGGER trg_enforce_freeze_request_notice
BEFORE INSERT ON public.member_freezes
FOR EACH ROW EXECUTE FUNCTION public.enforce_freeze_request_notice();